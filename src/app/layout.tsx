import "./globals.css";

export const metadata = {
  title: "onewallet radar",
  description: "Upcoming events in Thai cities as partner leads",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
