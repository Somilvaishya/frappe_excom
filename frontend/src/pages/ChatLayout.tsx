import { Outlet } from "react-router-dom";
import ChatSidebar from "@/components/ChatSidebar";

export default function ChatLayout() {
  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <ChatSidebar />
      <Outlet />
    </div>
  );
}
