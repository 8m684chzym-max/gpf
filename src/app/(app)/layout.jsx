import Nav from "@/components/Nav";
export default function AppLayout({ children }) {
  return (
    <div className="gpf-app">
      <Nav />
      <main className="content">{children}</main>
    </div>
  );
}
