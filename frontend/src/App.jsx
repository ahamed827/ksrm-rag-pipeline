import { useEffect, useState } from "react";
import Header from "./components/layout/Header.jsx";
import ChatView from "./components/chat/ChatView.jsx";
import KnowledgeMap from "./components/knowledge-map/KnowledgeMap.jsx";
import EvaluationView from "./components/evaluation/EvaluationView.jsx";
import useHealth from "./hooks/useHealth.js";
import useChatStream from "./hooks/useChatStream.js";

function bannerMessage({ health, status }) {
  if (status === "offline") {
    return "Can't reach the backend. Start it with: uvicorn app.main:app --port 8000 (in backend/).";
  }
  if (health && !health.index_ready) {
    return "The knowledge base hasn't been built yet. Run: python -m scripts.build_index (in backend/).";
  }
  if (health && !health.api_key_configured) {
    return "GEMINI_API_KEY is not set in backend/.env, so answers can't be generated.";
  }
  return null;
}

const TAB_IDS = ["chat", "map", "eval"];
const tabFromHash = () => {
  const id = window.location.hash.slice(1);
  return TAB_IDS.includes(id) ? id : "chat";
};

export default function App() {
  // The tab lives in the URL hash (#map, #eval) so links and the back button work.
  const [tab, setTabState] = useState(tabFromHash);
  const setTab = (id) => {
    window.location.hash = id === "chat" ? "" : id;
    setTabState(id);
  };

  useEffect(() => {
    const onHashChange = () => setTabState(tabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const healthState = useHealth();
  const chat = useChatStream(); // lives here so the conversation survives tab switches
  const banner = bannerMessage(healthState);

  return (
    <div className="flex h-full flex-col">
      <Header tab={tab} onTabChange={setTab} healthState={healthState} />
      {banner && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          {banner}
        </div>
      )}
      <main className="min-h-0 flex-1">
        {tab === "chat" && <ChatView {...chat} />}
        {tab === "map" && <KnowledgeMap onRebuilt={healthState.refresh} />}
        {tab === "eval" && <EvaluationView />}
      </main>
    </div>
  );
}
