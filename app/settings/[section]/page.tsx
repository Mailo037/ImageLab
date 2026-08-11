import ImageLab from "../../components/image-lab";
import { isSettingsSection } from "../../lib/settings-registry";

export default async function SettingsSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ workspace?: string }>;
}) {
  const [{ section }, { workspace }] = await Promise.all([params, searchParams]);
  return <ImageLab initialWorkspaceId={workspace} initialSettingsSection={isSettingsSection(section) ? section : "overview"} />;
}
