import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleGuard } from "@/components/RoleGuard";

export function PlaceholderPage({ path, title }: { path: string; title: string }) {
  return (
    <RoleGuard path={path}>
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Moduł w przygotowaniu.</p>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
