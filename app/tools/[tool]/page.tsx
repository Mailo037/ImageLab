import ImageLab from "../../components/image-lab";

export default async function ToolPage({
  params,
  searchParams,
}: {
  params: Promise<{ tool: string }>;
  searchParams: Promise<{ workspace?: string }>;
}) {
  const [{ tool }, { workspace }] = await Promise.all([params, searchParams]);
  return <ImageLab initialToolId={tool} initialWorkspaceId={workspace} />;
}
