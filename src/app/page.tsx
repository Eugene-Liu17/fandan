import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">饭单</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        一个 AI 对话式的每周家常菜单规划应用。
      </p>
      <Button>开始规划本周菜单</Button>
    </main>
  );
}
