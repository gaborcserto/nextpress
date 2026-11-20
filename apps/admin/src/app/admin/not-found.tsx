import { AdminErrorPage } from "../AdminErrorPage";

export default function NotFound() {
  return <AdminErrorPage status={404} insideShell />;
}
