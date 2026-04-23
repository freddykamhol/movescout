import UmzuegePageClient from "./umzuege-page-client";

import { getMoveTableData } from "@/lib/move-data";

export const dynamic = "force-dynamic";

export default async function UmzuegePage() {
  const moves = await getMoveTableData();

  return <UmzuegePageClient initialMoves={moves} />;
}
