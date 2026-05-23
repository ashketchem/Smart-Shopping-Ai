import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

// YouTube videos mock function
const getYouTubeVideos = (query) => [
  {
    id: "vid1",
    title: `${query} - Full Review & Unboxing`,
    channel: "Tech Reviews Today",
    thumbnail: `https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query + " review")}`,
    views: "1.2M",
  },
  {
    id: "vid2",
    title: `${query} vs Competitors - Detailed Comparison`,
    channel: "SmartBuy Channel",
    thumbnail: `https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query + " vs")}`,
    views: "850K",
  },
  {
    id: "vid3",
    title: `Is ${query} Worth Buying? Honest Review`,
    channel: "Consumer Reviews Pro",
    thumbnail: `https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query + " worth buying")}`,
    views: "650K",
  },
  {
    id: "vid4",
    title: `${query} Pros & Cons - Complete Guide`,
    channel: "Tech Explained",
    thumbnail: `https://i.ytimg.com/vi/ELIaH-6hVlE/hqdefault.jpg`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query + " guide")}`,
    views: "500K",
  },
];

// YouTube Video Card
function YouTubeCard({ video, i }) {
  return (
    <a href={video.url} target="_blank" rel="noreferrer" style={{
      display: "flex", gap: 10, padding: 10, background: "rgba(255,100,100,0.06)", backdropFilter: "blur(10px)",
      border: "1px solid rgba(255,100,100,0.12)", borderRadius: 12,
      textDecoration: "none", cursor: "pointer", transition: "all 0.2s",
      animation: `fadeUp 0.4s ease ${i * 0.05}s both`,
    }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "rgba(255,100,100,0.1)";
        e.currentTarget.style.borderColor = "rgba(255,100,100,0.25)";
        e.currentTarget.style.transform = "translateX(4px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "rgba(255,100,100,0.06)";
        e.currentTarget.style.borderColor = "rgba(255,100,100,0.12)";
        e.currentTarget.style.transform = "";
      }}
    >
      {/* Thumbnail with play button */}
      <div style={{ width: 100, height: 60, borderRadius: 8, background: "rgba(0,0,0,0.3)", flexShrink: 0, position: "relative", overflow: "hidden" }}>
        <img src={video.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.src = "https://via.placeholder.com/100x60/333/999?text=Video"; }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", opacity: 0.8 }}>
          <span style={{ fontSize: 18, color: "#ff3333" }}>▶</span>
        </div>
      </div>

      {/* Info */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.85)", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {video.title}
        </p>
        <div style={{ display: "flex", gap: 8, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
          <span>{video.channel}</span>
          <span>•</span>
          <span>{video.views}</span>
        </div>
      </div>
    </a>
  );
}

export default function App() {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("idle");
  const youtubeVideos = q ? getYouTubeVideos(q) : [];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0e1a 0%, #1a0f2e 50%, #0a0e1a 100%)", color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Syne:wght@700;800&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "40px 20px" }}>
        <h1 style={{ margin: "0 0 40px", fontSize: 28, fontWeight: 800 }}>SmartAI Shop</h1>

        {/* Search bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 30 }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search products..."
            style={{ flex: 1, padding: "12px 16px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, color: "#fff", fontSize: 14 }}
          />
        </div>

        {/* YouTube section */}
        {youtubeVideos.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>📺</span> Watch Reviews
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {youtubeVideos.map((video, i) => <YouTubeCard key={video.id} video={video} i={i} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}