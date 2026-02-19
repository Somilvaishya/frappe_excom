import { FrappeProvider } from "frappe-react-sdk";
import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "sonner";
import ChatLayout from "@/pages/ChatLayout";
import ChatWindow from "@/components/ChatWindow";
import EmptyState from "@/components/EmptyState";

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<ChatLayout />}>
        <Route index element={<EmptyState />} />
        <Route path=":profileId" element={<ChatWindow />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </>
  ),
  {
    basename: import.meta.env.VITE_BASE_NAME
      ? `/${import.meta.env.VITE_BASE_NAME}`
      : "",
  }
);

const getSiteName = () => {
  // @ts-expect-error
  return window.frappe?.boot?.sitename ?? import.meta.env.VITE_SITE_NAME;
};

function App() {
  return (
    <FrappeProvider
      url={import.meta.env.VITE_FRAPPE_PATH ?? ""}
      socketPort={
        import.meta.env.VITE_SOCKET_PORT
          ? import.meta.env.VITE_SOCKET_PORT
          : undefined
      }
      siteName={getSiteName()}
    >
      <Toaster
        richColors
        position="top-right"
        toastOptions={{
          style: {
            background: "#202c33",
            border: "1px solid #2a3942",
            color: "#e9edef",
          },
        }}
      />
      <RouterProvider router={router} />
    </FrappeProvider>
  );
}

export default App;
