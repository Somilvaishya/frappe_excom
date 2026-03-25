---
name: tailwind-react-ui
description: Tailwind CSS + React component patterns for Excom inbox UI. Use when building UI components, conversation lists, message threads, or responsive layouts.
---

# Tailwind + React UI for Excom Inbox

## Component Structure
```typescript
// components/ConversationItem.tsx
interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: (id: string) => void;
}

export function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
        ${isActive ? "bg-blue-50 border-l-2 border-blue-500" : "hover:bg-gray-50"}`}
      onClick={() => onClick(conversation.name)}
    >
      {/* ... */}
    </div>
  );
}
```

## Inbox Layout Pattern (3-Panel)
```
┌──────────┬────────────────┬──────────────┐
│ Channels │ Conversations  │  Message     │
│ Sidebar  │ List           │  Thread      │
│ (fixed)  │ (scrollable)   │  (scrollable)│
│ 60px     │ 320px          │  flex-1      │
└──────────┴────────────────┴──────────────┘

Mobile: stack vertically, show one panel at a time
```

```tsx
<div className="flex h-screen">
  <aside className="w-15 bg-gray-900 flex-shrink-0">{/* Channel icons */}</aside>
  <div className="w-80 border-r overflow-y-auto flex-shrink-0">{/* Conv list */}</div>
  <main className="flex-1 flex flex-col">{/* Thread */}</main>
</div>
```

## Performance Patterns

### Virtualized Conversation List (1000+ items)
```typescript
import { FixedSizeList } from "react-window";

<FixedSizeList
  height={windowHeight}
  itemCount={conversations.length}
  itemSize={72}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <ConversationItem conversation={conversations[index]} />
    </div>
  )}
</FixedSizeList>
```

### Message Thread — Auto-scroll + Load More
```typescript
const threadRef = useRef<HTMLDivElement>(null);
const [messages, setMessages] = useState<Message[]>([]);

// Auto-scroll to bottom on new message
useEffect(() => {
  threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
}, [messages.length]);

// Load more on scroll to top
const handleScroll = (e: UIEvent) => {
  if (e.currentTarget.scrollTop === 0) {
    loadOlderMessages();
  }
};
```

### Realtime Updates
```typescript
useEffect(() => {
  // Subscribe to conversation updates
  frappe.realtime.on("conversation_updated", (data) => {
    updateConversation(data.name);
  });
  
  frappe.realtime.on("new_message", (data) => {
    if (data.conversation === activeConversation) {
      appendMessage(data.message);
    }
    incrementUnreadCount(data.conversation);
  });
  
  return () => {
    frappe.realtime.off("conversation_updated");
    frappe.realtime.off("new_message");
  };
}, [activeConversation]);
```

## Accessibility
- All interactive elements: `aria-label` or `aria-labelledby`
- Conversation list: keyboard nav with arrow keys + Enter
- New message announcements: `aria-live="polite"` region
- Focus trap in compose area when active
- Color contrast: minimum 4.5:1 ratio for text

## Channel Badge Component
```tsx
const channelColors = {
  whatsapp: "bg-green-100 text-green-800",
  email: "bg-blue-100 text-blue-800",
  instagram: "bg-pink-100 text-pink-800",
} as const;

export function ChannelBadge({ channel }: { channel: keyof typeof channelColors }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${channelColors[channel]}`}>
      {channel}
    </span>
  );
}
```
