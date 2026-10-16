import { GameScreen } from "@/components/chess/GameScreen";
import { StructuredData } from "@/components/site/StructuredData";
import { absoluteUrl, pageMetadata, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata = pageMetadata("Play", SITE_DESCRIPTION, "/");

export default function Home() {
  return (
    <>
    <h1 className="sr-only">Play chess</h1>
    <GameScreen
      defaults={{ mode: "full_power", opponentId: "full-power-standard", humanColor: "w" }}
      resumeMode={["full_power", "practice", "import"]}
    />
    <StructuredData data={{ "@context": "https://schema.org", "@graph": [
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: SITE_NAME, url: SITE_URL, description: SITE_DESCRIPTION, inLanguage: "en" },
      { "@type": "WebApplication", "@id": `${SITE_URL}/#app`, name: SITE_NAME, url: SITE_URL, description: SITE_DESCRIPTION, applicationCategory: "GameApplication", operatingSystem: "Web browser", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, browserRequirements: "Requires JavaScript and WebAssembly", license: "https://www.gnu.org/licenses/gpl-3.0.html", image: absoluteUrl("/opengraph-image") },
    ] }} />
    </>
  );
}
