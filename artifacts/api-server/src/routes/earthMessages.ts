import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import {
  db,
  earthFamilyInvites,
  earthFamilyMembers,
  earthFamilyMessages,
  earthFamilyUploads,
} from "@workspace/db";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";

const router = Router();
const storage = new ObjectStorageService();
const ASTRONAUT_ID = "AST-01";
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MIME_TYPES: Record<string, "audio" | "video"> = {
  "audio/webm": "audio",
  "audio/ogg": "audio",
  "audio/mp4": "audio",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
};

type Actor = {
  userId: string;
  role: "astronaut" | "family" | "unlinked";
  email: string;
  member?: typeof earthFamilyMembers.$inferSelect;
};

const emailCache = new Map<string, { email: string; expiresAt: number }>();

function normalizedEmail(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

async function resolveActor(userId: string): Promise<Actor> {
  let cached = emailCache.get(userId);
  if (!cached || cached.expiresAt < Date.now()) {
    const user = await clerkClient.users.getUser(userId);
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      "";
    cached = { email, expiresAt: Date.now() + 60_000 };
    emailCache.set(userId, cached);
  }

  const configuredAstronaut = normalizedEmail(process.env.SPACEHEALTH_ASTRO_EMAIL);
  const isAstronaut =
    configuredAstronaut.length > 0 &&
    normalizedEmail(cached.email) === configuredAstronaut;
  if (isAstronaut) return { userId, email: cached.email, role: "astronaut" };

  const [member] = await db
    .select()
    .from(earthFamilyMembers)
    .where(eq(earthFamilyMembers.clerkUserId, userId))
    .limit(1);
  return member
    ? { userId, email: cached.email, role: "family", member }
    : { userId, email: cached.email, role: "unlinked" };
}

async function actorFor(req: Request, res: Response): Promise<Actor | null> {
  const userId = getAuth(req).userId;
  if (!userId) return null;
  try {
    return await resolveActor(userId);
  } catch {
    res.status(503).json({ error: "Could not verify the signed-in account." });
    return null;
  }
}

function requireAstronaut(actor: Actor | null, res: Response): actor is Actor & { role: "astronaut" } {
  if (!actor) {
    res.status(401).json({ error: "Sign in to continue." });
    return false;
  }
  if (actor.role !== "astronaut") {
    res.status(403).json({ error: "Only the astronaut account can do that." });
    return false;
  }
  return true;
}

function requireFamily(actor: Actor | null, res: Response): actor is Actor & { role: "family"; member: NonNullable<Actor["member"]> } {
  if (!actor) {
    res.status(401).json({ error: "Sign in to continue." });
    return false;
  }
  if (actor.role !== "family" || !actor.member) {
    res.status(403).json({ error: "Accept a current family invitation first." });
    return false;
  }
  return true;
}

function normalizedMimeType(value: unknown): string {
  return typeof value === "string" ? value.split(";")[0].trim().toLowerCase() : "";
}

function messageDto(message: typeof earthFamilyMessages.$inferSelect) {
  return {
    id: message.id,
    astronautId: message.astronautId,
    senderName: message.senderName,
    relationship: message.relationship,
    title: message.title,
    note: message.note,
    mediaType: message.mediaType,
    contentType: message.contentType,
    fileSize: message.fileSize,
    createdAt: message.createdAt.toISOString(),
    viewedAt: message.viewedAt?.toISOString() ?? null,
    mediaUrl: `/api/earth-messages/messages/${message.id}/media`,
  };
}

router.get("/earth-messages/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/earth-messages/session", async (req, res) => {
  const actor = await actorFor(req, res);
  if (!actor && !res.headersSent) return void res.json({ role: "signed-out" });
  if (!actor) return;
  res.json({
    role: actor.role,
    displayName: actor.member?.displayName ?? null,
    relationship: actor.member?.relationship ?? null,
  });
});

router.post("/earth-messages/invites", async (req, res) => {
  const actor = await actorFor(req, res);
  if (!requireAstronaut(actor, res)) return;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  try {
    await db.insert(earthFamilyInvites).values({
      tokenHash,
      createdByUserId: actor.userId,
      expiresAt,
    });
    res.status(201).json({ token, expiresAt: expiresAt.toISOString() });
  } catch {
    res.status(500).json({ error: "Could not create the family invitation." });
  }
});

router.post("/earth-messages/invites/accept", async (req, res) => {
  const actor = await actorFor(req, res);
  if (!actor) return;
  if (actor.role === "astronaut") {
    return void res.status(409).json({ error: "The astronaut account does not need an invitation." });
  }
  if (actor.role === "family") {
    return void res.status(409).json({ error: "This account is already connected to the family inbox." });
  }

  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const displayName =
    typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
  const relationship =
    typeof req.body?.relationship === "string" ? req.body.relationship.trim() : "";
  if (!token || displayName.length < 2 || displayName.length > 100) {
    return void res.status(400).json({ error: "Enter your name and a valid invitation." });
  }
  if (relationship.length < 2 || relationship.length > 80) {
    return void res.status(400).json({ error: "Enter your relationship to the astronaut." });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  try {
    const member = await db.transaction(async (tx) => {
      const [invite] = await tx
        .select()
        .from(earthFamilyInvites)
        .where(
          and(
            eq(earthFamilyInvites.tokenHash, tokenHash),
            isNull(earthFamilyInvites.acceptedAt),
            gt(earthFamilyInvites.expiresAt, new Date()),
          ),
        )
        .for("update")
        .limit(1);
      if (!invite) return null;

      const [created] = await tx
        .insert(earthFamilyMembers)
        .values({
          clerkUserId: actor.userId,
          astronautId: invite.astronautId,
          displayName,
          relationship,
        })
        .returning();
      await tx
        .update(earthFamilyInvites)
        .set({ acceptedByUserId: actor.userId, acceptedAt: new Date() })
        .where(eq(earthFamilyInvites.id, invite.id));
      return created;
    });

    if (!member) {
      return void res.status(410).json({ error: "This invitation is expired or was already used." });
    }
    res.status(201).json({
      role: "family",
      displayName: member.displayName,
      relationship: member.relationship,
    });
  } catch {
    res.status(500).json({ error: "Could not connect this account to the family inbox." });
  }
});

router.post("/earth-messages/uploads/request-url", async (req, res) => {
  const actor = await actorFor(req, res);
  if (!requireFamily(actor, res)) return;

  const contentType = normalizedMimeType(req.body?.contentType);
  const mediaType = MIME_TYPES[contentType];
  const size = Number(req.body?.size);
  if (!mediaType || !Number.isSafeInteger(size) || size < 1 || size > MAX_UPLOAD_BYTES) {
    return void res.status(400).json({
      error: "Choose a supported audio or video file under 100 MB.",
    });
  }

  try {
    const uploadUrl = await storage.getObjectEntityUploadURL();
    const objectPath = storage.normalizeObjectEntityPath(uploadUrl);
    await db.insert(earthFamilyUploads).values({
      objectPath,
      uploadedByUserId: actor.userId,
      contentType,
      declaredSize: size,
    });
    res.json({ uploadUrl, objectPath, maxBytes: MAX_UPLOAD_BYTES });
  } catch {
    res.status(503).json({ error: "Could not prepare a private media upload." });
  }
});

router.post("/earth-messages/messages", async (req, res) => {
  const actor = await actorFor(req, res);
  if (!requireFamily(actor, res)) return;

  const objectPath = typeof req.body?.objectPath === "string" ? req.body.objectPath : "";
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
  if (!objectPath.startsWith("/objects/uploads/") || title.length < 1 || title.length > 120 || note.length > 600) {
    return void res.status(400).json({ error: "The message details are incomplete or invalid." });
  }

  try {
    const [upload] = await db
      .select()
      .from(earthFamilyUploads)
      .where(
        and(
          eq(earthFamilyUploads.objectPath, objectPath),
          eq(earthFamilyUploads.uploadedByUserId, actor.userId),
          eq(earthFamilyUploads.consumed, false),
        ),
      )
      .limit(1);
    if (!upload) return void res.status(404).json({ error: "The pending upload was not found." });

    const file = await storage.getObjectEntityFile(objectPath);
    const [metadata] = await file.getMetadata();
    const contentType = normalizedMimeType(metadata.contentType);
    const actualSize = Number(metadata.size);
    const mediaType = MIME_TYPES[contentType];
    if (
      !mediaType ||
      contentType !== upload.contentType ||
      !Number.isSafeInteger(actualSize) ||
      actualSize < 1 ||
      actualSize > MAX_UPLOAD_BYTES ||
      actualSize !== upload.declaredSize
    ) {
      await file.delete({ ignoreNotFound: true }).catch(() => undefined);
      return void res.status(400).json({ error: "The uploaded file type or size is not supported." });
    }

    await storage.trySetObjectEntityAclPolicy(objectPath, {
      owner: actor.userId,
      visibility: "private",
    });
    const [message] = await db
      .insert(earthFamilyMessages)
      .values({
        astronautId: actor.member.astronautId,
        senderUserId: actor.userId,
        senderName: actor.member.displayName,
        relationship: actor.member.relationship,
        title,
        note: note || null,
        mediaType,
        contentType,
        fileSize: actualSize,
        objectPath,
      })
      .returning();
    await db
      .update(earthFamilyUploads)
      .set({ consumed: true })
      .where(eq(earthFamilyUploads.id, upload.id));
    res.status(201).json(messageDto(message));
  } catch {
    res.status(500).json({ error: "Could not save the family message." });
  }
});

router.get("/earth-messages/messages", async (req, res) => {
  const actor = await actorFor(req, res);
  if (!actor) return void res.status(401).json({ error: "Sign in to view family messages." });
  if (actor.role === "unlinked") {
    return void res.status(403).json({ error: "Accept a current family invitation first." });
  }

  const rows =
    actor.role === "astronaut"
      ? await db
          .select()
          .from(earthFamilyMessages)
          .where(eq(earthFamilyMessages.astronautId, ASTRONAUT_ID))
          .orderBy(desc(earthFamilyMessages.createdAt))
      : await db
          .select()
          .from(earthFamilyMessages)
          .where(
            and(
              eq(earthFamilyMessages.astronautId, actor.member!.astronautId),
              eq(earthFamilyMessages.senderUserId, actor.userId),
            ),
          )
          .orderBy(desc(earthFamilyMessages.createdAt));
  res.json(rows.map(messageDto));
});

router.patch("/earth-messages/messages/:id/viewed", async (req, res) => {
  const actor = await actorFor(req, res);
  if (!requireAstronaut(actor, res)) return;
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return void res.status(400).json({ error: "Invalid message id." });
  }
  const [message] = await db
    .update(earthFamilyMessages)
    .set({ viewedAt: new Date() })
    .where(
      and(
        eq(earthFamilyMessages.id, id),
        eq(earthFamilyMessages.astronautId, ASTRONAUT_ID),
      ),
    )
    .returning();
  if (!message) return void res.status(404).json({ error: "Message not found." });
  res.json(messageDto(message));
});

router.get("/earth-messages/messages/:id/media", async (req, res) => {
  const actor = await actorFor(req, res);
  if (!actor) return void res.status(401).json({ error: "Sign in to play this message." });
  if (actor.role === "unlinked") {
    return void res.status(403).json({ error: "Accept a current family invitation first." });
  }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return void res.status(400).json({ error: "Invalid message id." });
  }
  const conditions = [eq(earthFamilyMessages.id, id)];
  if (actor.role === "astronaut") {
    conditions.push(eq(earthFamilyMessages.astronautId, ASTRONAUT_ID));
  } else {
    conditions.push(eq(earthFamilyMessages.senderUserId, actor.userId));
  }
  const [message] = await db
    .select()
    .from(earthFamilyMessages)
    .where(and(...conditions))
    .limit(1);
  if (!message) return void res.status(404).json({ error: "Message not found." });

  try {
    const file = await storage.getObjectEntityFile(message.objectPath);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    const range = req.headers.range;
    res.setHeader("Content-Type", message.contentType);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        res.setHeader("Content-Range", `bytes */${size}`);
        return void res.status(416).end();
      }
      const suffix = match[1] ? null : Number(match[2]);
      const start = suffix === null ? Number(match[1]) : Math.max(0, size - suffix);
      const end = match[2] && match[1] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (!Number.isSafeInteger(start) || start < 0 || start >= size || end < start) {
        res.setHeader("Content-Range", `bytes */${size}`);
        return void res.status(416).end();
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", String(end - start + 1));
      file.createReadStream({ start, end }).on("error", () => res.destroy()).pipe(res);
      return;
    }
    res.setHeader("Content-Length", String(size));
    file.createReadStream().on("error", () => res.destroy()).pipe(res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      return void res.status(404).json({ error: "Media file not found." });
    }
    return void res.status(503).json({ error: "Could not load this private media file." });
  }
});

router.get("/storage/public-objects/*path", async (req, res) => {
  try {
    const rawPath = req.params.path;
    const filePath = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;
    const file = await storage.searchPublicObject(filePath);
    if (!file) return void res.status(404).json({ error: "Public object not found." });
    const response = await storage.downloadObject(file);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.status(response.status);
    if (response.body) {
      const { Readable } = await import("node:stream");
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch {
    res.status(503).json({ error: "Could not load the public asset." });
  }
});

export default router;
