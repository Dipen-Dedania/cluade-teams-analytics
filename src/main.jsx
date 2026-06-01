import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BarChart3,
  ArrowLeft,
  Boxes,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileUp,
  FolderKanban,
  Gauge,
  MessageSquareText,
  Palette,
  Search,
  Sparkles,
  Users,
  Wand2
} from "lucide-react";
import "./styles.css";

const tabs = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "people", label: "People", icon: Users },
  { id: "topics", label: "Topics", icon: Sparkles },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "files", label: "Files", icon: FileUp },
  { id: "design", label: "Design Chats", icon: Palette },
  { id: "conversations", label: "Conversations", icon: MessageSquareText }
];

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

function compact(value) {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function formatMinutes(value) {
  if (!value) return "0m";
  if (value < 60) return `${value}m`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function useAnalytics() {
  const [state, setState] = useState({ status: "loading", data: null, error: null });

  useEffect(() => {
    fetch("/generated/analytics.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Analytics file returned ${response.status}`);
        return response.json();
      })
      .then((data) => setState({ status: "ready", data, error: null }))
      .catch((error) => setState({ status: "error", data: null, error }));
  }, []);

  return state;
}

function StatCard({ icon: Icon, label, value, tone = "blue", detail }) {
  return (
    <article className={cx("stat-card", `tone-${tone}`)}>
      <div className="stat-icon">
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
    </article>
  );
}

function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="section-header">
      <div>
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ title }) {
  return <div className="empty-state">{title}</div>;
}

function MiniBarChart({ data, labelKey = "name", valueKey = "count", limit = 12, formatter = formatNumber }) {
  const rows = data.slice(0, limit);
  const max = Math.max(1, ...rows.map((row) => row[valueKey] || 0));
  return (
    <div className="mini-bars">
      {rows.map((row) => (
        <div className="bar-row" key={row[labelKey]}>
          <span className="bar-label" title={row[labelKey]}>{row[labelKey]}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max(4, ((row[valueKey] || 0) / max) * 100)}%` }} />
          </div>
          <strong>{formatter(row[valueKey])}</strong>
        </div>
      ))}
    </div>
  );
}

function Timeline({ rows }) {
  const points = rows || [];
  const max = Math.max(1, ...points.map((point) => point.count));
  const width = 720;
  const height = 170;
  const pad = 16;
  const step = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const line = points
    .map((point, index) => {
      const x = pad + index * step;
      const y = height - pad - (point.count / max) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="timeline-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Conversation activity timeline">
        <defs>
          <linearGradient id="activityGradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="55%" stopColor="#0f9f8f" />
            <stop offset="100%" stopColor="#e4572e" />
          </linearGradient>
        </defs>
        <polyline className="grid-line" points={`${pad},${height - pad} ${width - pad},${height - pad}`} />
        <polyline className="timeline-line" points={line} />
        {points.map((point, index) => {
          const x = pad + index * step;
          const y = height - pad - (point.count / max) * (height - pad * 2);
          return <circle key={point.name} cx={x} cy={y} r="4" />;
        })}
      </svg>
      <div className="timeline-labels">
        <span>{points[0]?.name || ""}</span>
        <span>{points[points.length - 1]?.name || ""}</span>
      </div>
    </div>
  );
}

function HourChart({ values }) {
  const max = Math.max(1, ...(values || []));
  return (
    <div className="hour-grid">
      {(values || []).map((value, index) => (
        <div className="hour-cell" key={index}>
          <div className="hour-column" title={`${index}:00 - ${formatNumber(value)} conversations`}>
            <span style={{ height: `${Math.max(5, (value / max) * 100)}%` }} />
          </div>
          <small>{index}</small>
        </div>
      ))}
    </div>
  );
}

function WeekdayChart({ values }) {
  const max = Math.max(1, ...(values || []));
  return (
    <div className="weekday-grid">
      {weekdays.map((day, index) => (
        <div className="weekday-cell" key={day}>
          <span style={{ opacity: 0.24 + ((values[index] || 0) / max) * 0.76 }} />
          <strong>{day}</strong>
          <small>{formatNumber(values[index] || 0)}</small>
        </div>
      ))}
    </div>
  );
}

function DataTable({ columns, rows, limit = 10 }) {
  const visible = rows.slice(0, limit);
  if (!visible.length) return <EmptyState title="No rows" />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, rowIndex) => (
            <tr key={row.uuid || row.name || row.email || rowIndex}>
              {columns.map((column) => (
                <td key={column.key} className={column.align === "right" ? "num" : ""}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowButton({ children, onClick }) {
  return (
    <button className="row-button" type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function TopicPill({ name }) {
  return <span className="topic-pill">{name}</span>;
}

function Overview({ data }) {
  const { summary } = data;
  const topUsers = data.users.slice(0, 8);
  const topConversations = [...data.conversations].sort((a, b) => b.totalChars - a.totalChars).slice(0, 8);

  return (
    <>
      <section className="stat-grid">
        <StatCard icon={Users} label="Active Users" value={`${summary.activeUsers}/${summary.users}`} detail={`${summary.inactiveUsers} inactive`} tone="green" />
        <StatCard icon={MessageSquareText} label="Conversations" value={formatNumber(summary.conversations)} detail={`${summary.avgMessagesPerConversation} msg / chat`} />
        <StatCard icon={Activity} label="Messages" value={formatNumber(summary.messages)} detail={`${formatNumber(summary.humanMessages)} human`} tone="orange" />
        <StatCard icon={FileUp} label="Uploads" value={formatNumber(summary.files)} detail={`${formatNumber(summary.attachments)} attachments`} tone="violet" />
        <StatCard icon={Wand2} label="Tool Blocks" value={formatNumber(summary.toolUses)} detail={`${formatNumber(summary.thinkingBlocks)} thinking`} tone="teal" />
        <StatCard icon={Clock3} label="P90 Duration" value={formatMinutes(summary.p90DurationMinutes)} detail={`${summary.p90MessagesPerConversation} p90 messages`} tone="rose" />
      </section>

      <section className="dashboard-grid">
        <div className="surface wide">
          <SectionHeader eyebrow="Daily" title="Conversation Activity" />
          <Timeline rows={summary.byDay} />
        </div>
        <div className="surface">
          <SectionHeader eyebrow="Topics" title="Detected Themes" />
          <MiniBarChart data={data.topics} limit={10} />
        </div>
        <div className="surface">
          <SectionHeader eyebrow="People" title="Most Active Users" />
          <DataTable
            rows={topUsers}
            limit={8}
            columns={[
              { key: "name", label: "Name", render: (row) => <UserCell user={row} /> },
              { key: "conversations", label: "Chats", align: "right", render: (row) => formatNumber(row.conversations) },
              { key: "files", label: "Files", align: "right", render: (row) => formatNumber(row.files) }
            ]}
          />
        </div>
        <div className="surface">
          <SectionHeader eyebrow="Clock" title="Hour Distribution" />
          <HourChart values={summary.byHour} />
        </div>
        <div className="surface">
          <SectionHeader eyebrow="Week" title="Weekday Distribution" />
          <WeekdayChart values={summary.byWeekday} />
        </div>
        <div className="surface wide">
          <SectionHeader eyebrow="Longest" title="Deep Work Conversations" />
          <DataTable
            rows={topConversations}
            limit={8}
            columns={[
              { key: "name", label: "Conversation", render: (row) => <ConversationTitle row={row} /> },
              { key: "userName", label: "User" },
              { key: "messages", label: "Msg", align: "right", render: (row) => formatNumber(row.messages) },
              { key: "totalChars", label: "Chars", align: "right", render: (row) => compact(row.totalChars) }
            ]}
          />
        </div>
      </section>
    </>
  );
}

function UserCell({ user }) {
  return (
    <div className="user-cell">
      <span>{user.name || "Unknown"}</span>
      <small>{user.email || user.uuid}</small>
    </div>
  );
}

function ConversationTitle({ row }) {
  return (
    <div className="conversation-title">
      <span>{row.name}</span>
      <small>{formatDate(row.updatedAt)} · {row.topic}</small>
    </div>
  );
}

function UserDrilldown({ data, user, onBack }) {
  const [conversationSort, setConversationSort] = useState("updatedAt");
  const [query, setQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState(null);
  const userConversations = useMemo(() => {
    const q = query.toLowerCase();
    return data.conversations
      .filter((conversation) => conversation.userUuid === user.uuid)
      .filter((conversation) => `${conversation.name} ${conversation.summary} ${conversation.topic} ${conversation.keywords?.join(" ")}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (conversationSort === "updatedAt") return (b.updatedAt || "").localeCompare(a.updatedAt || "");
        return (b[conversationSort] || 0) - (a[conversationSort] || 0);
      });
  }, [conversationSort, data.conversations, query, user.uuid]);

  return (
    <>
      <section className="profile-header">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft size={17} aria-hidden="true" />
          <span>People</span>
        </button>
        <div>
          <span className="eyebrow">Member Drilldown</span>
          <h2>{user.name}</h2>
          <p>{user.email || user.uuid}</p>
        </div>
      </section>

      <section className="stat-grid profile-stats">
        <StatCard icon={MessageSquareText} label="Conversations" value={formatNumber(user.conversations)} detail={`${user.messagesPerConversation} msg / chat`} />
        <StatCard icon={Activity} label="Messages" value={formatNumber(user.messages)} detail={`${formatNumber(user.humanMessages)} human`} tone="orange" />
        <StatCard icon={CalendarDays} label="Active Days" value={formatNumber(user.activeDays)} detail={`${formatDate(user.firstActivity)} onward`} tone="green" />
        <StatCard icon={FileUp} label="Files" value={formatNumber(user.files)} detail={`${formatNumber(user.attachments)} attachments`} tone="violet" />
        <StatCard icon={Wand2} label="Tool Uses" value={formatNumber(user.toolUses)} detail={`${formatNumber(user.thinkingBlocks)} thinking`} tone="teal" />
        <StatCard icon={BarChart3} label="Avg Prompt" value={formatNumber(user.promptCharsPerHumanMessage)} detail="chars / human msg" tone="rose" />
      </section>

      <section className="dashboard-grid">
        <div className="surface">
          <SectionHeader eyebrow="Topics" title="This Member's Themes" />
          <MiniBarChart data={user.topics || []} limit={8} />
        </div>
        <div className="surface">
          <SectionHeader eyebrow="Clock" title="Usage by Hour" />
          <HourChart values={user.byHour} />
        </div>
        <div className="surface wide">
          <SectionHeader
            eyebrow={`${formatNumber(userConversations.length)} conversations`}
            title="Conversation History"
            action={<Toolbar query={query} setQuery={setQuery} sort={conversationSort} setSort={setConversationSort} options={["updatedAt", "messages", "totalChars", "files", "toolUses", "durationMinutes"]} />}
          />
          <div className="conversation-list compact">
            {userConversations.map((conversation) => (
              <button className="conversation-row clickable" key={conversation.uuid} type="button" onClick={() => setSelectedConversation(conversation)}>
                <div>
                  <div className="conversation-row-head">
                    <h3>{conversation.name}</h3>
                    <TopicPill name={conversation.topic} />
                  </div>
                  <p>{conversation.summary || conversation.firstPrompts?.[0] || "No summary available"}</p>
                  <div className="keyword-line">
                    {(conversation.keywords || []).slice(0, 6).map((keyword) => <span key={keyword}>{keyword}</span>)}
                  </div>
                </div>
                <dl>
                  <div><dt>Updated</dt><dd>{formatDate(conversation.updatedAt)}</dd></div>
                  <div><dt>Messages</dt><dd>{formatNumber(conversation.messages)}</dd></div>
                  <div><dt>Chars</dt><dd>{compact(conversation.totalChars)}</dd></div>
                  <div><dt>Files</dt><dd>{formatNumber(conversation.files)}</dd></div>
                </dl>
              </button>
            ))}
          </div>
        </div>
      </section>

      {selectedConversation ? (
        <ConversationDrawer
          conversation={selectedConversation}
          onClose={() => setSelectedConversation(null)}
        />
      ) : null}
    </>
  );
}

function ConversationDrawer({ conversation, onClose }) {
  const [state, setState] = useState({ status: "loading", detail: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", detail: null, error: null });
    fetch(`/generated/conversations/${conversation.uuid}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Conversation detail returned ${response.status}`);
        return response.json();
      })
      .then((detail) => {
        if (!cancelled) setState({ status: "ready", detail, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", detail: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, [conversation.uuid]);

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="conversation-drawer" role="dialog" aria-modal="true" aria-label="Conversation detail" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <span className="eyebrow">{conversation.topic}</span>
            <h2>{conversation.name}</h2>
            <p>{conversation.userName} · {formatDate(conversation.createdAt)} to {formatDate(conversation.updatedAt)}</p>
          </div>
          <button className="close-button" type="button" onClick={onClose}>Close</button>
        </div>

        <div className="drawer-stats">
          <Metric label="Messages" value={conversation.messages} />
          <Metric label="Chars" value={compact(conversation.totalChars)} />
          <Metric label="Files" value={conversation.files} />
          <Metric label="Tools" value={conversation.toolUses} />
        </div>

        {state.status === "loading" ? <EmptyState title="Loading conversation..." /> : null}
        {state.status === "error" ? <EmptyState title="Conversation detail file was not found. Run npm run analyze again." /> : null}
        {state.status === "ready" ? (
          <div className="message-thread">
            {state.detail.messages.map((message) => (
              <article className={cx("message-card", message.role === "human" ? "human" : "assistant")} key={message.uuid}>
                <header>
                  <strong>{message.role === "human" ? "User" : "Claude"}</strong>
                  <span>{formatDate(message.createdAt)}</span>
                </header>
                <pre>{message.text || "[No text content]"}</pre>
                {message.files.length || message.attachments.length ? (
                  <div className="message-assets">
                    {message.files.map((file, index) => <span key={`file-${index}`}>{file.name}</span>)}
                    {message.attachments.map((attachment, index) => <span key={`attachment-${index}`}>{attachment.name}</span>)}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function People({ data }) {
  const [sort, setSort] = useState("conversations");
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const rows = useMemo(() => {
    const filtered = data.users
      .filter((user) => {
        if (segment === "active") return user.conversations > 0;
        if (segment === "inactive") return user.conversations === 0;
        if (segment === "weekend") return user.usedWeekend;
        return true;
      })
      .filter((user) => {
        const text = `${user.name} ${user.email}`.toLowerCase();
        return text.includes(query.toLowerCase());
      });
    return filtered.sort((a, b) => (b[sort] || 0) - (a[sort] || 0));
  }, [data.users, query, segment, sort]);

  const segmentCounts = useMemo(() => ({
    all: data.users.length,
    active: data.users.filter((user) => user.conversations > 0).length,
    inactive: data.users.filter((user) => user.conversations === 0).length,
    weekend: data.users.filter((user) => user.usedWeekend).length
  }), [data.users]);

  if (selectedUser) {
    const freshUser = data.users.find((user) => user.uuid === selectedUser.uuid) || selectedUser;
    return <UserDrilldown data={data} user={freshUser} onBack={() => setSelectedUser(null)} />;
  }

  return (
    <section className="surface full">
      <SectionHeader
        eyebrow={`${formatNumber(rows.length)} members`}
        title="People Analytics"
        action={
          <div className="people-actions">
            <SegmentedControl
              value={segment}
              onChange={setSegment}
              options={[
                { value: "all", label: "All", count: segmentCounts.all },
                { value: "active", label: "Active", count: segmentCounts.active },
                { value: "inactive", label: "Inactive", count: segmentCounts.inactive },
                { value: "weekend", label: "Weekend", count: segmentCounts.weekend }
              ]}
            />
            <Toolbar query={query} setQuery={setQuery} sort={sort} setSort={setSort} options={["conversations", "messages", "files", "weekendConversations", "promptCharsPerHumanMessage", "toolUses"]} />
          </div>
        }
      />
      <DataTable
        rows={rows}
        limit={40}
        columns={[
          { key: "name", label: "Member", render: (row) => <UserCell user={row} /> },
          { key: "conversations", label: "Chats", align: "right", render: (row) => formatNumber(row.conversations) },
          { key: "messages", label: "Messages", align: "right", render: (row) => formatNumber(row.messages) },
          { key: "activeDays", label: "Days", align: "right", render: (row) => formatNumber(row.activeDays) },
          { key: "weekendConversations", label: "Weekend", align: "right", render: (row) => formatNumber(row.weekendConversations) },
          { key: "promptCharsPerHumanMessage", label: "Avg Prompt", align: "right", render: (row) => formatNumber(row.promptCharsPerHumanMessage) },
          { key: "files", label: "Files", align: "right", render: (row) => formatNumber(row.files) },
          { key: "toolUses", label: "Tools", align: "right", render: (row) => formatNumber(row.toolUses) },
          { key: "lastActivity", label: "Last Active", render: (row) => formatDate(row.lastActivity) },
          { key: "topics", label: "Top Topic", render: (row) => row.topics[0] ? <TopicPill name={row.topics[0].name} /> : "None" }
        ].map((column) => ({
          ...column,
          render: (row) => (
            <RowButton onClick={() => setSelectedUser(row)}>
              {column.render ? column.render(row) : row[column.key]}
            </RowButton>
          )
        }))}
      />
    </section>
  );
}

function Topics({ data }) {
  const rows = data.topics.map((topic) => {
    const conversations = data.conversations.filter((conversation) => conversation.topic === topic.name);
    return {
      ...topic,
      messages: conversations.reduce((sum, conversation) => sum + conversation.messages, 0),
      files: conversations.reduce((sum, conversation) => sum + conversation.files, 0),
      users: new Set(conversations.map((conversation) => conversation.userUuid)).size,
      samples: conversations.slice(0, 3)
    };
  });

  return (
    <section className="dashboard-grid">
      <div className="surface">
        <SectionHeader eyebrow="Detected" title="Topic Mix" />
        <MiniBarChart data={data.topics} limit={12} />
      </div>
      <div className="surface wide">
        <SectionHeader eyebrow="Themes" title="Topic Detail" />
        <DataTable
          rows={rows}
          limit={20}
          columns={[
            { key: "name", label: "Topic", render: (row) => <TopicPill name={row.name} /> },
            { key: "count", label: "Chats", align: "right", render: (row) => formatNumber(row.count) },
            { key: "users", label: "Users", align: "right", render: (row) => formatNumber(row.users) },
            { key: "messages", label: "Messages", align: "right", render: (row) => formatNumber(row.messages) },
            { key: "files", label: "Files", align: "right", render: (row) => formatNumber(row.files) },
            { key: "samples", label: "Recent Samples", render: (row) => row.samples.map((sample) => sample.name).join(", ") }
          ]}
        />
      </div>
    </section>
  );
}

function Projects({ data }) {
  return (
    <section className="dashboard-grid">
      <div className="surface">
        <SectionHeader eyebrow="Projects" title="Project Summary" />
        <div className="metric-list">
          <Metric label="Total" value={data.projectSummary.total} />
          <Metric label="Private" value={data.projectSummary.private} />
          <Metric label="Docs" value={data.projectSummary.docs} />
          <Metric label="Doc Chars" value={compact(data.projectSummary.docChars)} />
        </div>
      </div>
      <div className="surface">
        <SectionHeader eyebrow="Creators" title="Project Owners" />
        <MiniBarChart data={data.projectSummary.topCreators || []} limit={10} />
      </div>
      <div className="surface wide">
        <SectionHeader eyebrow="Project Files" title="Projects" />
        <DataTable
          rows={data.projects}
          limit={30}
          columns={[
            { key: "name", label: "Project", render: (row) => <div className="conversation-title"><span>{row.name}</span><small>{row.creator}</small></div> },
            { key: "docCount", label: "Docs", align: "right", render: (row) => formatNumber(row.docCount) },
            { key: "docChars", label: "Doc Chars", align: "right", render: (row) => compact(row.docChars) },
            { key: "isPrivate", label: "Access", render: (row) => row.isPrivate ? "Private" : "Shared" },
            { key: "updatedAt", label: "Updated", render: (row) => formatDate(row.updatedAt) }
          ]}
        />
      </div>
      <div className="surface wide">
        <SectionHeader eyebrow="Knowledge" title="Largest Project Docs" />
        <DataTable
          rows={data.projectDocs}
          limit={12}
          columns={[
            { key: "filename", label: "File" },
            { key: "projectName", label: "Project" },
            { key: "chars", label: "Chars", align: "right", render: (row) => compact(row.chars) }
          ]}
        />
      </div>
    </section>
  );
}

function Files({ data }) {
  const topUploaders = [...data.users].sort((a, b) => b.files - a.files).slice(0, 20);
  return (
    <section className="dashboard-grid">
      <div className="surface">
        <SectionHeader eyebrow="Extensions" title="File Types" />
        <MiniBarChart data={data.files.extensions} limit={14} />
      </div>
      <div className="surface">
        <SectionHeader eyebrow="People" title="Top Uploaders" />
        <DataTable
          rows={topUploaders}
          limit={12}
          columns={[
            { key: "name", label: "Member", render: (row) => <UserCell user={row} /> },
            { key: "files", label: "Files", align: "right", render: (row) => formatNumber(row.files) }
          ]}
        />
      </div>
      <div className="surface wide">
        <SectionHeader eyebrow="Names" title="Most Repeated Files" />
        <DataTable
          rows={data.files.names}
          limit={30}
          columns={[
            { key: "name", label: "Filename" },
            { key: "count", label: "Count", align: "right", render: (row) => formatNumber(row.count) }
          ]}
        />
      </div>
    </section>
  );
}

function DesignChats({ data }) {
  return (
    <section className="dashboard-grid">
      <div className="surface">
        <SectionHeader eyebrow="Design" title="Design Summary" />
        <div className="metric-list">
          <Metric label="Chats" value={data.designSummary.total} />
          <Metric label="Messages" value={data.designSummary.messages} />
          <Metric label="Attachments" value={data.designSummary.attachments} />
        </div>
      </div>
      <div className="surface">
        <SectionHeader eyebrow="Projects" title="Design Project Mix" />
        <MiniBarChart data={data.designSummary.topProjects || []} limit={10} />
      </div>
      <div className="surface wide">
        <SectionHeader eyebrow="Chats" title="Design Chat Index" />
        <DataTable
          rows={data.designChats}
          limit={30}
          columns={[
            { key: "title", label: "Title", render: (row) => <div className="conversation-title"><span>{row.title}</span><small>{row.projectName}</small></div> },
            { key: "messages", label: "Messages", align: "right", render: (row) => formatNumber(row.messages) },
            { key: "attachments", label: "Attachments", align: "right", render: (row) => formatNumber(row.attachments) },
            { key: "updatedAt", label: "Updated", render: (row) => formatDate(row.updatedAt) }
          ]}
        />
      </div>
    </section>
  );
}

function Conversations({ data }) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("All");
  const [sort, setSort] = useState("updatedAt");
  const [selectedConversation, setSelectedConversation] = useState(null);
  const topicOptions = ["All", ...data.topics.map((item) => item.name)];

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return data.conversations
      .filter((conversation) => topic === "All" || conversation.topic === topic)
      .filter((conversation) => {
        const text = `${conversation.name} ${conversation.userName} ${conversation.summary} ${conversation.keywords?.join(" ")}`.toLowerCase();
        return text.includes(q);
      })
      .sort((a, b) => {
        if (sort === "updatedAt") return (b.updatedAt || "").localeCompare(a.updatedAt || "");
        return (b[sort] || 0) - (a[sort] || 0);
      });
  }, [data.conversations, query, sort, topic]);

  return (
    <section className="surface full">
      <SectionHeader
        eyebrow={`${formatNumber(rows.length)} matches`}
        title="Conversation Explorer"
        action={
          <div className="toolbar split">
            <SearchBox value={query} onChange={setQuery} />
            <Select value={topic} onChange={setTopic} options={topicOptions} />
            <Select value={sort} onChange={setSort} options={["updatedAt", "messages", "totalChars", "files", "toolUses", "durationMinutes"]} />
          </div>
        }
      />
      <div className="conversation-list">
        {rows.slice(0, 60).map((conversation) => (
          <button className="conversation-row clickable" key={conversation.uuid} type="button" onClick={() => setSelectedConversation(conversation)}>
            <div>
              <div className="conversation-row-head">
                <h3>{conversation.name}</h3>
                <TopicPill name={conversation.topic} />
              </div>
              <p>{conversation.summary || conversation.firstPrompts?.[0] || "No summary available"}</p>
              <div className="keyword-line">
                {(conversation.keywords || []).slice(0, 6).map((keyword) => <span key={keyword}>{keyword}</span>)}
              </div>
            </div>
            <dl>
              <div><dt>User</dt><dd>{conversation.userName}</dd></div>
              <div><dt>Updated</dt><dd>{formatDate(conversation.updatedAt)}</dd></div>
              <div><dt>Messages</dt><dd>{formatNumber(conversation.messages)}</dd></div>
              <div><dt>Chars</dt><dd>{compact(conversation.totalChars)}</dd></div>
              <div><dt>Files</dt><dd>{formatNumber(conversation.files)}</dd></div>
              <div><dt>Tools</dt><dd>{formatNumber(conversation.toolUses)}</dd></div>
            </dl>
          </button>
        ))}
      </div>
      {selectedConversation ? (
        <ConversationDrawer
          conversation={selectedConversation}
          onClose={() => setSelectedConversation(null)}
        />
      ) : null}
    </section>
  );
}

function Toolbar({ query, setQuery, sort, setSort, options }) {
  return (
    <div className="toolbar">
      <SearchBox value={query} onChange={setQuery} />
      <Select value={sort} onChange={setSort} options={options} />
    </div>
  );
}

function SegmentedControl({ value, onChange, options }) {
  return (
    <div className="segmented-control" role="group" aria-label="People filter">
      {options.map((option) => (
        <button
          key={option.value}
          className={value === option.value ? "active" : ""}
          type="button"
          onClick={() => onChange(option.value)}
        >
          <span>{option.label}</span>
          <strong>{formatNumber(option.count)}</strong>
        </button>
      ))}
    </div>
  );
}

function SearchBox({ value, onChange }) {
  return (
    <label className="search-box">
      <Search size={16} aria-hidden="true" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search" />
    </label>
  );
}

function Select({ value, onChange, options }) {
  return (
    <label className="select-box">
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown size={16} aria-hidden="true" />
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{typeof value === "number" ? formatNumber(value) : value}</strong>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const analytics = useAnalytics();

  if (analytics.status === "loading") {
    return <main className="loading-shell">Loading analytics...</main>;
  }

  if (analytics.status === "error") {
    return (
      <main className="loading-shell">
        <strong>Analytics data is missing.</strong>
        <span>Run npm run analyze and refresh this page.</span>
      </main>
    );
  }

  const data = analytics.data;

  return (
    <main>
      <header className="app-header">
        <div>
          <span className="eyebrow">Claude Teams Export</span>
          <h1>Team Conversation Analytics</h1>
          <p>{formatDate(data.meta.exportDateRange[0])} to {formatDate(data.meta.exportDateRange[1])} · generated {formatDate(data.meta.generatedAt)}</p>
        </div>
        <div className="header-badge">
          <CalendarDays size={18} aria-hidden="true" />
          <span>{data.summary.byDay.length} active days</span>
        </div>
      </header>

      <nav className="tabs" aria-label="Analytics sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
              <Icon size={17} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {activeTab === "overview" && <Overview data={data} />}
      {activeTab === "people" && <People data={data} />}
      {activeTab === "topics" && <Topics data={data} />}
      {activeTab === "projects" && <Projects data={data} />}
      {activeTab === "files" && <Files data={data} />}
      {activeTab === "design" && <DesignChats data={data} />}
      {activeTab === "conversations" && <Conversations data={data} />}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
