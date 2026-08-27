export default function StackLogo({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="stack-logo">
      <img src={src} alt={`${alt} logo`} className="stack-logo-img" width={28} height={28} />
    </div>
  );
}

export function StackLogos({ logos, alt }: { logos: string[]; alt: string }) {
  return (
    <div className="stack-logos">
      {logos.map((logo) => (
        <img key={logo} src={logo} alt={`${alt} logo`} className="stack-logo-img" width={28} height={28} />
      ))}
    </div>
  );
}
