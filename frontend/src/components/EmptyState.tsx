import { BiMessageRoundedDetail } from "react-icons/bi";

export default function EmptyState() {
  return (
    <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-chat-bg relative">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <div className="z-10 text-center max-w-md px-8">
        <div className="w-20 h-20 rounded-full bg-chat-accent/10 flex items-center justify-center mx-auto mb-6">
          <BiMessageRoundedDetail className="text-chat-accent" size={40} />
        </div>
        <h2 className="text-[32px] font-light text-[#e9edef] mb-3">
          Excom Chat
        </h2>
        <p className="text-sm text-chat-muted leading-relaxed">
          Send and receive WhatsApp messages directly from your workspace.
          Select a conversation to get started.
        </p>
        <div className="mt-8 pt-6 border-t border-chat-border/30">
          <p className="text-xs text-chat-muted/60">
            Powered by WhatsApp Business Cloud API
          </p>
        </div>
      </div>
    </div>
  );
}
