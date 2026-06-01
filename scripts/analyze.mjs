import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const outputDir = path.join(rootDir, "public", "generated");
const conversationOutputDir = path.join(outputDir, "conversations");

const conversationsPath = path.join(dataDir, "conversations.json");
const usersPath = path.join(dataDir, "users.json");
const projectsDir = path.join(dataDir, "projects");
const designChatsDir = path.join(dataDir, "design_chats");
const memoriesPath = path.join(dataDir, "memories.json");

const topicDefinitions = [
  ["Backend", ["api", "backend", "server", "express", "node", "database", "postgres", "mongodb", "redis", "auth", "jwt"]],
  ["Frontend", ["react", "next.js", "nextjs", "css", "tailwind", "component", "frontend", "ui", "webapp", "dashboard"]],
  ["Design", ["design", "prototype", "figma", "wireframe", "mockup", "layout", "visual", "screen", "canvas"]],
  ["DevOps", ["gitlab", "ci/cd", "pipeline", "docker", "deploy", "firebase", "build", "release", "environment"]],
  ["Data & BI", ["power bi", "report", "analytics", "dashboard", "excel", "csv", "sql", "query", "metric"]],
  ["Mobile", ["android", "ios", "react native", "flutter", "apk", "mobile", "firebase"]],
  ["Learning", ["learn", "teach", "explain", "master", "roadmap", "course", "tutorial", "basics"]],
  ["Writing", ["email", "content", "copy", "document", "proposal", "blog", "message", "summary"]],
  ["Code Review", ["review", "refactor", "bug", "fix", "error", "issue", "quality", "test", "debug"]],
  ["Product", ["requirement", "story", "feature", "module", "flow", "user", "acceptance", "product"]]
];

const stopWords = new Set([
  "about", "after", "again", "also", "been", "being", "build", "can", "chat", "claude", "code", "create", "from", "have",
  "help", "into", "just", "make", "need", "please", "should", "that", "the", "this", "with", "your", "using", "will"
]);

function safeJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function resetDir(dir) {
  const resolved = path.resolve(dir);
  const generatedRoot = path.resolve(outputDir);
  if (!resolved.startsWith(generatedRoot)) {
    throw new Error(`Refusing to reset path outside generated output: ${resolved}`);
  }
  if (existsSync(resolved)) rmSync(resolved, { recursive: true, force: true });
  mkdirSync(resolved, { recursive: true });
}

function minDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function maxDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function dayKey(value) {
  return value ? value.slice(0, 10) : "unknown";
}

function monthKey(value) {
  return value ? value.slice(0, 7) : "unknown";
}

function dateParts(value) {
  if (!value) return { hour: null, weekday: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { hour: null, weekday: null };
  return { hour: date.getUTCHours(), weekday: date.getUTCDay() };
}

function addCount(map, key, amount = 1) {
  const cleanKey = key || "Unknown";
  map.set(cleanKey, (map.get(cleanKey) || 0) + amount);
}

function topEntries(map, limit = 20) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function extensionFromName(name) {
  if (!name || !name.includes(".")) return "unknown";
  return name.split(".").pop().toLowerCase().slice(0, 16) || "unknown";
}

function textFromMessage(message) {
  if (typeof message.text === "string" && message.text.trim()) return message.text;
  if (!Array.isArray(message.content)) return "";
  return message.content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

function messageContentTypes(message) {
  const counts = new Map();
  for (const part of message.content || []) addCount(counts, part.type || "unknown");
  return topEntries(counts, 12);
}

function classifyTopic(text) {
  const haystack = text.toLowerCase();
  const scored = topicDefinitions.map(([name, keywords]) => {
    const score = keywords.reduce((sum, keyword) => sum + (haystack.includes(keyword) ? 1 : 0), 0);
    return { name, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].name : "General";
}

function extractKeywords(text, limit = 8) {
  const counts = new Map();
  for (const match of text.toLowerCase().matchAll(/[a-z][a-z0-9.+#-]{2,}/g)) {
    const word = match[0].replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
    if (word.length < 3 || stopWords.has(word)) continue;
    addCount(counts, word);
  }
  return topEntries(counts, limit).map((entry) => entry.name);
}

function compactFiles(files = []) {
  return files.map((file) => ({
    name: file.file_name || file.filename || file.name || "Unknown",
    fileType: file.file_type || file.type || "",
    size: file.file_size || file.size || null
  }));
}

function compactAttachments(attachments = []) {
  return attachments.map((attachment) => ({
    name: attachment.name || attachment.file_name || attachment.filename || attachment.type || "Attachment",
    type: attachment.type || "",
    id: attachment.id || attachment.uuid || ""
  }));
}

function emptyUserStats(user) {
  return {
    uuid: user.uuid,
    name: user.full_name || user.email_address || "Unknown",
    email: user.email_address || "",
    conversations: 0,
    messages: 0,
    humanMessages: 0,
    assistantMessages: 0,
    promptChars: 0,
    assistantChars: 0,
    files: 0,
    attachments: 0,
    toolUses: 0,
    toolResults: 0,
    thinkingBlocks: 0,
    tokenBudgetBlocks: 0,
    firstActivity: null,
    lastActivity: null,
    activeDays: new Set(),
    byHour: Array(24).fill(0),
    byWeekday: Array(7).fill(0),
    topics: new Map()
  };
}

function finalizeUser(user) {
  const promptCharsPerHumanMessage = user.humanMessages ? Math.round(user.promptChars / user.humanMessages) : 0;
  const messagesPerConversation = user.conversations ? Math.round((user.messages / user.conversations) * 10) / 10 : 0;
  const weekendConversations = (user.byWeekday[0] || 0) + (user.byWeekday[6] || 0);
  return {
    ...user,
    activeDays: user.activeDays.size,
    weekendConversations,
    usedWeekend: weekendConversations > 0,
    promptCharsPerHumanMessage,
    messagesPerConversation,
    topics: topEntries(user.topics, 8)
  };
}

function percentile(sortedValues, pct) {
  if (!sortedValues.length) return 0;
  const index = Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * pct));
  return sortedValues[index];
}

async function streamTopLevelArray(filePath, onItem) {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: "utf8", highWaterMark: 1024 * 512 });
    let started = false;
    let capturing = false;
    let buffer = "";
    let depth = 0;
    let inString = false;
    let escaped = false;
    let pending = Promise.resolve();

    function captureChar(char) {
      buffer += char;

      if (escaped) {
        escaped = false;
        return;
      }
      if (char === "\\") {
        escaped = true;
        return;
      }
      if (char === "\"") {
        inString = !inString;
        return;
      }
      if (inString) return;

      if (char === "{") depth += 1;
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          const raw = buffer;
          buffer = "";
          capturing = false;
          pending = pending.then(() => onItem(JSON.parse(raw)));
        }
      }
    }

    stream.on("data", (chunk) => {
      for (const char of chunk) {
        if (!started) {
          if (char === "[") started = true;
          continue;
        }

        if (!capturing) {
          if (char === "{") {
            capturing = true;
            depth = 0;
            inString = false;
            escaped = false;
            captureChar(char);
          }
          continue;
        }

        captureChar(char);
      }
    });

    stream.on("end", () => pending.then(resolve, reject));
    stream.on("error", reject);
  });
}

function readProjects() {
  const projects = [];
  const docsByProject = [];
  const creatorCounts = new Map();
  if (!existsSync(projectsDir)) return { projects, summary: {}, docsByProject };

  for (const file of readdirSync(projectsDir).filter((name) => name.endsWith(".json"))) {
    const project = safeJson(path.join(projectsDir, file), null);
    if (!project) continue;
    const docs = project.docs || [];
    addCount(creatorCounts, project.creator?.full_name || "Unknown");
    docsByProject.push(...docs.map((doc) => ({
      projectUuid: project.uuid,
      projectName: project.name,
      filename: doc.filename || "Untitled",
      chars: (doc.content || "").length
    })));
    projects.push({
      uuid: project.uuid,
      name: project.name || "Untitled",
      description: project.description || "",
      isPrivate: Boolean(project.is_private),
      isStarterProject: Boolean(project.is_starter_project),
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      creator: project.creator?.full_name || "Unknown",
      docCount: docs.length,
      docChars: docs.reduce((sum, doc) => sum + (doc.content || "").length, 0),
      promptTemplateChars: (project.prompt_template || "").length
    });
  }

  return {
    projects,
    docsByProject: docsByProject.sort((a, b) => b.chars - a.chars),
    summary: {
      total: projects.length,
      private: projects.filter((project) => project.isPrivate).length,
      starter: projects.filter((project) => project.isStarterProject).length,
      docs: docsByProject.length,
      docChars: docsByProject.reduce((sum, doc) => sum + doc.chars, 0),
      topCreators: topEntries(creatorCounts, 10)
    }
  };
}

function readDesignChats() {
  const chats = [];
  const byProject = new Map();
  if (!existsSync(designChatsDir)) return { chats, summary: {} };

  for (const file of readdirSync(designChatsDir).filter((name) => name.endsWith(".json"))) {
    const chat = safeJson(path.join(designChatsDir, file), null);
    if (!chat) continue;
    const messages = chat.messages || [];
    const attachmentCount = messages.reduce((sum, message) => {
      const nested = Array.isArray(message.content?.attachments) ? message.content.attachments.length : 0;
      const direct = Array.isArray(message.attachments) ? message.attachments.length : 0;
      return sum + nested + direct;
    }, 0);
    const projectName = chat.project?.name || "No project";
    addCount(byProject, projectName);
    chats.push({
      uuid: chat.uuid,
      title: chat.title || "Untitled",
      projectUuid: chat.project?.uuid || "",
      projectName,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
      messages: messages.length,
      attachments: attachmentCount
    });
  }

  return {
    chats,
    summary: {
      total: chats.length,
      messages: chats.reduce((sum, chat) => sum + chat.messages, 0),
      attachments: chats.reduce((sum, chat) => sum + chat.attachments, 0),
      topProjects: topEntries(byProject, 10)
    }
  };
}

async function analyze() {
  ensureDir(outputDir);
  resetDir(conversationOutputDir);

  const users = safeJson(usersPath, []);
  const usersByUuid = new Map(users.map((user) => [user.uuid, emptyUserStats(user)]));
  const topicCounts = new Map();
  const fileExtensionCounts = new Map();
  const fileNameCounts = new Map();
  const contentTypeCounts = new Map();
  const conversations = [];
  const messageCounts = [];
  const conversationDurations = [];

  const global = {
    generatedAt: new Date().toISOString(),
    source: {
      conversationsPath: path.relative(rootDir, conversationsPath),
      usersPath: path.relative(rootDir, usersPath)
    },
    users: users.length,
    activeUsers: 0,
    inactiveUsers: 0,
    conversations: 0,
    messages: 0,
    humanMessages: 0,
    assistantMessages: 0,
    promptChars: 0,
    assistantChars: 0,
    files: 0,
    attachments: 0,
    toolUses: 0,
    toolResults: 0,
    thinkingBlocks: 0,
    tokenBudgetBlocks: 0,
    firstActivity: null,
    lastActivity: null,
    byDay: new Map(),
    byMonth: new Map(),
    byHour: Array(24).fill(0),
    byWeekday: Array(7).fill(0)
  };

  await streamTopLevelArray(conversationsPath, async (conversation) => {
    const userUuid = conversation.account?.uuid || "unknown";
    if (!usersByUuid.has(userUuid)) {
      usersByUuid.set(userUuid, emptyUserStats({ uuid: userUuid, full_name: "Unknown user", email_address: "" }));
    }
    const user = usersByUuid.get(userUuid);
    const messages = conversation.chat_messages || [];
    const createdAt = conversation.created_at;
    const updatedAt = conversation.updated_at;
    const created = createdAt ? new Date(createdAt).getTime() : null;
    const updated = updatedAt ? new Date(updatedAt).getTime() : null;
    const durationMinutes = created && updated ? Math.max(0, Math.round((updated - created) / 60000)) : 0;

    let humanMessages = 0;
    let assistantMessages = 0;
    let promptChars = 0;
    let assistantChars = 0;
    let files = 0;
    let attachments = 0;
    let toolUses = 0;
    let toolResults = 0;
    let thinkingBlocks = 0;
    let tokenBudgetBlocks = 0;
    let combinedText = `${conversation.name || ""}\n${conversation.summary || ""}\n`;
    const firstHumanMessages = [];

    for (const message of messages) {
      const text = textFromMessage(message);
      combinedText += `${text}\n`;

      if (message.sender === "human") {
        humanMessages += 1;
        promptChars += text.length;
        if (firstHumanMessages.length < 2 && text.trim()) firstHumanMessages.push(text.trim().slice(0, 220));
      } else if (message.sender === "assistant") {
        assistantMessages += 1;
        assistantChars += text.length;
      }

      attachments += Array.isArray(message.attachments) ? message.attachments.length : 0;
      files += Array.isArray(message.files) ? message.files.length : 0;
      for (const file of message.files || []) {
        const name = file.file_name || file.filename || file.name || "Unknown";
        addCount(fileNameCounts, name);
        addCount(fileExtensionCounts, extensionFromName(name));
      }

      for (const part of message.content || []) {
        addCount(contentTypeCounts, part.type || "unknown");
        if (part.type === "tool_use") toolUses += 1;
        if (part.type === "tool_result") toolResults += 1;
        if (part.type === "thinking") thinkingBlocks += 1;
        if (part.type === "token_budget") tokenBudgetBlocks += 1;
      }
    }

    const topic = classifyTopic(combinedText);
    const keywords = extractKeywords(combinedText, 7);
    addCount(topicCounts, topic);
    addCount(user.topics, topic);

    const { hour, weekday } = dateParts(createdAt);
    if (hour !== null) {
      global.byHour[hour] += 1;
      user.byHour[hour] += 1;
    }
    if (weekday !== null) {
      global.byWeekday[weekday] += 1;
      user.byWeekday[weekday] += 1;
    }

    addCount(global.byDay, dayKey(createdAt));
    addCount(global.byMonth, monthKey(createdAt));
    user.activeDays.add(dayKey(createdAt));

    global.conversations += 1;
    global.messages += messages.length;
    global.humanMessages += humanMessages;
    global.assistantMessages += assistantMessages;
    global.promptChars += promptChars;
    global.assistantChars += assistantChars;
    global.files += files;
    global.attachments += attachments;
    global.toolUses += toolUses;
    global.toolResults += toolResults;
    global.thinkingBlocks += thinkingBlocks;
    global.tokenBudgetBlocks += tokenBudgetBlocks;
    global.firstActivity = minDate(global.firstActivity, createdAt);
    global.lastActivity = maxDate(global.lastActivity, updatedAt || createdAt);

    user.conversations += 1;
    user.messages += messages.length;
    user.humanMessages += humanMessages;
    user.assistantMessages += assistantMessages;
    user.promptChars += promptChars;
    user.assistantChars += assistantChars;
    user.files += files;
    user.attachments += attachments;
    user.toolUses += toolUses;
    user.toolResults += toolResults;
    user.thinkingBlocks += thinkingBlocks;
    user.tokenBudgetBlocks += tokenBudgetBlocks;
    user.firstActivity = minDate(user.firstActivity, createdAt);
    user.lastActivity = maxDate(user.lastActivity, updatedAt || createdAt);

    messageCounts.push(messages.length);
    conversationDurations.push(durationMinutes);
    conversations.push({
      uuid: conversation.uuid,
      name: conversation.name || "Untitled",
      summary: (conversation.summary || "").replace(/\s+/g, " ").trim().slice(0, 420),
      createdAt,
      updatedAt,
      userUuid,
      userName: user.name,
      userEmail: user.email,
      messages: messages.length,
      humanMessages,
      assistantMessages,
      promptChars,
      assistantChars,
      totalChars: promptChars + assistantChars,
      files,
      attachments,
      toolUses,
      toolResults,
      thinkingBlocks,
      tokenBudgetBlocks,
      durationMinutes,
      topic,
      keywords,
      firstPrompts: firstHumanMessages
    });

    writeFileSync(
      path.join(conversationOutputDir, `${conversation.uuid}.json`),
      JSON.stringify({
        uuid: conversation.uuid,
        name: conversation.name || "Untitled",
        summary: conversation.summary || "",
        createdAt,
        updatedAt,
        userUuid,
        userName: user.name,
        userEmail: user.email,
        messages: messages.map((message) => ({
          uuid: message.uuid,
          role: message.sender || message.role || "unknown",
          createdAt: message.created_at,
          updatedAt: message.updated_at,
          text: textFromMessage(message),
          attachments: compactAttachments(message.attachments || []),
          files: compactFiles(message.files || []),
          contentTypes: messageContentTypes(message),
          parentMessageUuid: message.parent_message_uuid || ""
        }))
      }),
      "utf8"
    );
  });

  messageCounts.sort((a, b) => a - b);
  conversationDurations.sort((a, b) => a - b);

  const userRows = Array.from(usersByUuid.values()).map(finalizeUser);
  global.activeUsers = userRows.filter((user) => user.conversations > 0).length;
  global.inactiveUsers = userRows.filter((user) => user.conversations === 0).length;
  global.avgMessagesPerConversation = global.conversations ? Math.round((global.messages / global.conversations) * 10) / 10 : 0;
  global.avgPromptChars = global.humanMessages ? Math.round(global.promptChars / global.humanMessages) : 0;
  global.p50MessagesPerConversation = percentile(messageCounts, 0.5);
  global.p90MessagesPerConversation = percentile(messageCounts, 0.9);
  global.p90DurationMinutes = percentile(conversationDurations, 0.9);
  global.byDay = topEntries(global.byDay, 400).sort((a, b) => a.name.localeCompare(b.name));
  global.byMonth = topEntries(global.byMonth, 60).sort((a, b) => a.name.localeCompare(b.name));
  global.contentTypes = topEntries(contentTypeCounts, 20);

  const projectData = readProjects();
  const designChatData = readDesignChats();
  const memories = safeJson(memoriesPath, []);

  const analytics = {
    meta: {
      generatedAt: global.generatedAt,
      exportDateRange: [global.firstActivity, global.lastActivity],
      note: "Generated from local Claude Teams export files. Raw conversations are streamed one item at a time by scripts/analyze.mjs."
    },
    summary: global,
    users: userRows.sort((a, b) => b.conversations - a.conversations || b.messages - a.messages),
    conversations: conversations.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")),
    topics: topEntries(topicCounts, 20),
    files: {
      total: global.files,
      extensions: topEntries(fileExtensionCounts, 20),
      names: topEntries(fileNameCounts, 30)
    },
    projects: projectData.projects.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")),
    projectSummary: projectData.summary,
    projectDocs: projectData.docsByProject.slice(0, 30),
    designChats: designChatData.chats.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")),
    designSummary: designChatData.summary,
    memories: {
      count: Array.isArray(memories) ? memories.length : Object.keys(memories || {}).length
    }
  };

  writeFileSync(path.join(outputDir, "analytics.json"), JSON.stringify(analytics, null, 2));
  console.log(`Generated ${path.relative(rootDir, path.join(outputDir, "analytics.json"))}`);
  console.log(`${global.conversations} conversations, ${global.messages} messages, ${global.activeUsers}/${global.users} active users`);
}

analyze().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
