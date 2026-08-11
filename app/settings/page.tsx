import ImageLab from "../components/image-lab";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { workspace } = await searchParams;
  return <ImageLab initialWorkspaceId={workspace} initialSettingsSection="overview" />;
}
