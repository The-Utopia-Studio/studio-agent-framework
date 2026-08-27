import { BUILD_TOOLS } from '../data/tools';

export default function ToolLogo({ id, size = 28 }: { id: string; size?: number }) {
  const tool = BUILD_TOOLS.find((t) => t.id === id);
  if (!tool) return null;

  return (
    <img
      src={tool.logo}
      alt={`${tool.name} logo`}
      width={size}
      height={size}
      className="tool-logo-img"
      style={{ width: size, height: size }}
    />
  );
}
