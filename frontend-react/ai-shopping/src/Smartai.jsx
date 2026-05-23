import { useState, useEffect, useRef, useCallback} from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

const API_BASE = "http://localhost:8080/api";
const GEMINI_KEY = 'AIzaSyDAJPcRqeLvJXBNrIlb3J_8Af9imHv4ing';

const MODELS = [
    { url: "/models/mococo_abyssgard.glb", label: "Abyssgard Mococo" },
    { url: "/models/3d_anime_character_girl_for_blender_c1.glb", label: "alt girl"},
];

async function apiSearch(q) {
    const res = await fetch(`${API_BASE}/search?query=${encodeURIComponent(q)}`);
    return { status: res.status, data: await res.json()};
}

async function apiPoll(q) {
    const res = await fetch(`${API_BASE}/results?query=${encodeURIComponent(q)}`);
    return { status: res.status, data: await res.json()};
}


async function geminiAnalyze(products) {
    if (!products || products.length === 0) {
        return "No products found to analyze. Please execute a query first.";
    }

    const activeKey = GEMINI_KEY;

    // Safety fallback check
    if (!activeKey || activeKey === "your_actual_key_here") {
        console.error("CRITICAL: Please replace the placeholder string with your actual API key.");
        return "Error: API Key is unconfigured or using placeholder text.";
    }

    const lines = products
        .slice(0, 15)
        .map(p => `[${p.platform}] ${p.name === "N/A" ? p.description : p.name} | ${p.price} | Reviews: ${p.reviews}`)
        .join("\n");

    try {
        // Updated URL to point to the active gemini-2.5-flash production model
        const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${activeKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You're a smart shopping assistant. Analyze:\n\n${lines}\n\nGive: best value pick, platform with better deals, quick buying advice, for whom the product is best suited, and any other insights you can find. Be concise. Under 150 words, friendly tone. Use bullet points if needed.`
                    }]
                }]
            })
        });

        const d = await res.json();
        
        if (d.error) {
            console.error("Gemini API Error details:", d.error);
            return `Gemini API Error: ${d.error.message} (Code: ${d.error.code})`;
        }

        return d.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, couldn't analyze the products.";
    } catch (err) {
        console.error("Network or parsing error:", err);
        return "Network error: Failed to communicate with the analysis server.";
    }
}
function AvatarScene({ modelIndex, onToggle}) {
    const mountRef = useRef(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const clickRef = useRef(false);
    const rafRef = useRef(null);
    const [loadState, setLoadState] = useState("loading");

    useEffect(() => {
        const  container = mountRef.current;
        if(!container) return;
        const W = container.clientWidth || 250, H = container.clientHeight || 400;

       /* this is where i rendered the 3D model, i have downloaded this models from: 
       sketchfab .com, make sure to visit it for more different models. (CREDITS ^_~ ) */

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(W,H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.3;

        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 50);
        camera.position.set(0, 1.3, 3.8);
        camera.lookAt(0, 1, 0);


        /*lighting setup: bright key light, softer fill light, and a rim light for separation from background,
        we can custimize it however we want. but mistakes here can make the model look flat, too harsh, or lose details.
        so we need to find a good balance that shows off the model's features 
        while keeping it visually appealing.*/

        scene.add( new THREE.AmbientLight(0xffffff, 1.4));
        const key = new THREE.DirectionalLight(0xaabbff, 2.5);
        key.position.set(2,5,3);
        scene.add(key);

        const fill = new THREE.DirectionalLight(0xaabbff, 1);
        fill.position.set(-3, 2, 1);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xff88ee, 0.7);
        rim.position.set(0, 2, -2);
        scene.add(rim);

        // adds sparkles around the model

        const sparkles = Array.from({ length:20}, (_, i) => {
            const m = new THREE.Mesh(
                new THREE.SphereGeometry(0.014, 5, 5),
                new THREE.MeshBasicMaterial({ color: [0x99aaff, 0xffaaee, 0xaaffcc][i % 3], transparent: true, opacity: 0.9})
            );
            const angle = (i/ 20) * Math.PI * 2;
            const r = 0.5 + Math.random() * 0.9;
            m.position.set(Math.cos(angle) * r, Math.random() * 2.2 + 0.3, Math.sin(angle) * r * 0.4);
            m.userData = { baseY: m.position.y, speed: 0.4 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2, angle, r };
            scene.add(m);
            return m;
        });
        
        // Ground halo for the 3D model
        const halo = new THREE.Mesh(
            new THREE.CircleGeometry(0.9, 32), 
            new THREE.MeshBasicMaterial({ color: 0x9966ff, transparent: true, opacity: 0.12}));
        halo.rotation.x = -Math.PI / 2;
        halo.position.y = 0.001;
        scene.add(halo);

        /* Model state, here we will define the model properties */

        let headBone = null, neckBone = null, rightArmBone = null;
        let mixer = null, model = null, idleAction = null, pointAction = null;

        /* here idelaction defines what type of action our model should take, and pointaction is defined as where should the figure point towards, you can add more propertires if you want to.. */

        const loader = new GLTFLoader();
        loader.load(
            MODELS[modelIndex].url,
            (gltf) => {
                model = gltf.scene;
                
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());

                console.log("=== MODEL DIAGNOSTICS ===");
                console.log("Original Model Size:", size);
                console.log("Original Model Center:", center);
                console.log(`Loaded: ${MODELS[modelIndex].label} | Animations found in file:`, gltf.animations?.length || 0);

                model.userData.baseRotX = model.rotation.x;
                model.userData.baseRotY = model.rotation.y;
                model.userData.baseRotZ = model.rotation.z;

                const scale = Math.max(size.x, size.y, size.z) > 0 ? 2 / Math.max(size.x, size.y, size.z) : 1;
                model.scale.setScalar(scale);

                model.position.set(0,0,0)
                model.position.x = -center.x * scale;
                model.position.z = -center.z * scale;
                model.position.y = -box.min.y * scale;

                model. traverse(node => { 
                    if (node.isMesh) { node.castShadow = true;
                        node.receiveShadow = true;
                        if (node.material) {
                            node.material.side = THREE.DoubleSide;
                        }
                    }
                    if (node.isBone) {
                        const n = node.name.toLowerCase();
                        if (!headBone && n.includes("head")) headBone = node;
                        if (!neckBone && n.includes("neck")) neckBone = node;
                        if (!rightArmBone && (n.includes("right arm") || n.includes("r_arm") || n.includes("arm_r") || n.includes("upperarm_r"))) rightArmBone = node;
                    }
                });

                scene.add(model);

                if (gltf.animations && gltf.animations.length > 0) {
                    mixer = new THREE.AnimationMixer(model);
                    const idle = gltf.animations.find(a => /idle|stand|breath|default/i.test(a.name)) || gltf.animations[0];
                    idleAction = mixer.clipAction(idle);
                    idleAction.play();
                     
                const pointClip = gltf.animations.find(a => /point|wave|hi|greet/i.test(a.name));
                if (pointClip) {
                  pointAction = mixer.clipAction(pointClip);
                  pointAction.setLoop(THREE.LoopOnce, 1);
                  pointAction.clampWhenFinished = true;
                }
              }


                setLoadState("done");
            },
            undefined, (error) => {
                console.error("GLTF Loading Failed:", error)
                setLoadState("error");
            }
        );

        let lastTime = performance.now();
        let t = 0;

        const animate = () => {

        rafRef.current = requestAnimationFrame(animate);
        const now = performance.now();
        const dt  = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        t += dt;

        if (mixer) mixer.update(dt);

        const mx = mouseRef.current.x, my = mouseRef.current.y;
        
        if (model) {
            const baseX = model.userData.baseRotX || 0;
        const baseY = model.userData.baseRotY || 0;
        const baseZ = model.userData.baseRotZ || 0;

        // OPTION A: MOCOCO (No standard head/neck bones found)
        if (!headBone) {
          model.rotation.y += (baseY + mx * 0.65 - model.rotation.y) * 0.1;
          model.rotation.x += (baseX - my * 0.25 - model.rotation.x) * 0.1;

        } 
        else { // rigged body 
                      model.rotation.y += (baseY + mx * 0.2 - model.rotation.y) * 0.1;
          model.rotation.x = baseX;
          headBone.rotation.y = mx * 0.4;
          headBone.rotation.x = -my * 0.3;
          if (neckBone) {
            neckBone.rotation.y = mx * 0.15;
            neckBone.rotation.x = -my * 0.1;
          }
        }
        model.rotation.z = baseZ;

    }
    if (rightArmBone && !pointAction) {
        const targetZ = clickRef.current ? -1.9 : (rightArmBone.userData.basez || 0);
        const targetX = clickRef.current ? -0.6 : (rightArmBone.userData.baseX || 0);
        rightArmBone.rotation.z += (targetZ - rightArmBone.rotation.z) * 0.1;
        rightArmBone.rotation.x += (targetX - rightArmBone.rotation.x) * 0.1;
      }
      
      
      sparkles.forEach((s, i) => {
        s.userData.angle += dt * 0.18 * ( i % 2 ? 1: -1);
        s.position.x = Math.cos(s.userData.angle) * s.userData.r;
        s.position.z = Math.sin(s.userData.angle) * s.userData.r * 0.4;
        s.position.y = s.userData.baseY + Math.sin(t * s.userData.speed + s.userData.phase) * 0.15;
        s.material.opacity = 0.35 + Math.abs(Math.sin(t * s.userData.speed + s.userData.phase)) * 0.6;
      });

      if (halo) halo.material.opacity = 0.07 + Math.sin(t*1.2) * 0.06;
      renderer.render(scene, camera);
    };
      
        animate();

        return () => {
            cancelAnimationFrame(rafRef.current);
            renderer.dispose();
            if (container && container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        };
        }, [modelIndex]);

        useEffect(() => {
            const h = e => {
                mouseRef.current = {
                    x: (e.clientX / window.innerWidth) * 2 -1,
                    y: -((e.clientY / window.innerHeight) * 2-1),
                };
            };
            window.addEventListener("mousemove", h);
            return () => window.removeEventListener("mousemove", h);
        }, []);

        const handleClick = () => {
            clickRef.current = true;
            setTimeout(() => { 
                clickRef.current = false;
            }, 2000);
        };

            return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%", cursor: "pointer" }} onClick={handleClick} />
 
      {loadState === "loading" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, backdropFilter: "blur(2px)" }}>
          <div style={{ width: 28, height: 28, border: "2.5px solid rgba(180,140,255,0.15)", borderTopColor: "#b088ff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
          <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.25)" }}>Loading avatar...</p>
        </div>
      )}
 
      {loadState === "error" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "0 16px", backdropFilter: "blur(2px)" }}>
          <p style={{ margin: 0, fontSize: 24 }}>🌸</p>
          <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.25)", textAlign: "center", lineHeight: 1.5 }}>
            Copy .glb files to<br /><code style={{ color: "#b088ff", fontSize: 9 }}>public/models/</code>
          </p>
        </div>
      )}
 
      <button onClick={onToggle} style={{
        position: "absolute", top: 6, right: 6, background: "rgba(255,255,255,0.08)", backdropFilter: "blur(6px)",
        border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.35)",
        borderRadius: 16, padding: "3px 9px", fontSize: 9, cursor: "pointer"
      }}>×</button>
 
      {loadState === "done" && (
        <p style={{ position: "absolute", bottom: 4, left: 0, right: 0, textAlign: "center", fontSize: 8, color: "rgba(255,255,255,0.12)", margin: 0 }}>
          move · click
        </p>
      )}
    </div>
  );
}
 
// ── Product Card ──────────────────────────────────────────────────────────────
function Card({ p, i }) {
  const [err, setErr] = useState(false);
  const colors = {
    Amazon: ["#FF9900", "#111"],
    Flipkart: ["#2874F0", "#fff"],
    "Reliance Digital": ["#cc0000", "#fff"],
  };
  const [bg, fg] = colors[p.platform] || ["#8B5FBF", "#fff"];
 
  return (
    <div style={{
      background: "rgba(255,255,255,0.05)", backdropFilter: "blur(10px)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
      overflow: "hidden", display: "flex", flexDirection: "column",
      animation: `fadeUp 0.4s ease ${i * 0.04}s both`,
      transition: "all 0.2s",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
        e.currentTarget.style.borderColor = "rgba(180,140,255,0.3)";
        e.currentTarget.style.transform = "translateY(-4px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
        e.currentTarget.style.transform = "";
      }}
    >
      <div style={{ height: 150, background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {!err && p.imageUrl
          ? <img src={p.imageUrl} alt="" onError={() => setErr(true)} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", padding: 10 }} />
          : <span style={{ fontSize: 28, opacity: 0.15 }}>📦</span>
        }
      </div>
      <div style={{ padding: "12px 13px", flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ background: bg, color: fg, fontSize: 8, fontWeight: 900, padding: "2px 7px", borderRadius: 18, letterSpacing: 0.5 }}>
            {p.platform}
          </span>
          {p.reviews && p.reviews !== "N/A" && (
            <span style={{ fontSize: 9, color: "rgba(255,200,150,0.7)" }}>⭐ {p.reviews.split(" ")[0]}</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.8)", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {(p.name && p.name !== "N/A") ? p.name : p.description}
        </p>
        <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#7cffb2", fontFamily: "monospace", marginTop: "auto" }}>
          {p.price || "—"}
        </p>
      </div>
      {p.productUrl && p.productUrl !== "N/A" && (
        <a href={p.productUrl} target="_blank" rel="noreferrer" style={{
          display: "block", padding: "8px", textAlign: "center", fontSize: 10, fontWeight: 500,
          background: "rgba(180,140,255,0.08)", borderTop: "1px solid rgba(255,255,255,0.05)",
          color: "#b088ff", textDecoration: "none", backdropFilter: "blur(4px)",
        }}>View</a>
      )}
    </div>
  );
}
 
// ── AI Panel ──────────────────────────────────────────────────────────────────
function AIPanel({ products }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
 
  const run = async () => {
    setBusy(true);
    try {
      setText(await geminiAnalyze(products));
    } catch {
      setText("Add VITE_GEMINI_KEY to .env — free at aistudio.google.com");
    }
    setBusy(false);
    setDone(true);
  };
 
  return (
    <div style={{ marginTop: 18, background: "rgba(180,140,255,0.08)", backdropFilter: "blur(10px)", border: "1px solid rgba(180,140,255,0.2)", borderRadius: 16, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: done ? 12 : 0 }}>
        <span style={{ fontSize: 16 }}>✨</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>AI Shopping Advisor</p>
          <p style={{ margin: 0, fontSize: 9, color: "rgba(255,255,255,0.25)" }}>Powered by Gemini</p>
        </div>
        {!done && (
          <button onClick={run} disabled={busy} style={{
            background: "rgba(180,140,255,0.15)", backdropFilter: "blur(6px)",
            border: "1px solid rgba(180,140,255,0.35)", color: "#b088ff",
            padding: "6px 14px", borderRadius: 20, fontSize: 10, cursor: "pointer", fontWeight: 500,
          }}>{busy ? "..." : "Analyze"}</button>
        )}
      </div>
      {text && (
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
          {text}
        </p>
      )}
    </div>
  );
}
 
// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("idle");
  const [avatar, setAvatar] = useState(true);
  const [modelIdx, setModelIdx] = useState(0);
  const [filter, setFilter] = useState("all");
  const pollRef = useRef(null);
  const countRef = useRef(0);
 
  const stopPoll = () => { clearInterval(pollRef.current); countRef.current = 0; };
  const startPoll = useCallback((query) => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      if (++countRef.current > 25) { stopPoll(); setStatus("error"); return; }
      try {
        const { status: s, data } = await apiPoll(query);
        if (s === 200 && Array.isArray(data) && data.length > 0) {
          stopPoll(); setProducts(data); setStatus("done");
        }
      } catch {}
    }, 3000);
  }, []);
 
  const search = async () => {
    if (!q.trim()) return;
    setStatus("searching"); setProducts([]); setFilter("all");
    try {
      const { status: s, data } = await apiSearch(q);
      if (s === 200 && Array.isArray(data) && data.length > 0) { setProducts(data); setStatus("done"); }
      else if (s === 202) startPoll(q.toLowerCase().trim());
      else setStatus("error");
    } catch { setStatus("error"); }
  };
 
  const platforms = [...new Set(products.map(p => p.platform).filter(Boolean))];
  const shown = filter === "all" ? products : products.filter(p => p.platform === filter);
 
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0e1a 0%, #1a0f2e 50%, #0a0e1a 100%)", color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Syne:wght@700;800&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.15); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(180,140,255,0.25); border-radius: 2px; }
      `}</style>
 
      {/* Animated BG orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(138,90,255,0.15) 0%, transparent 70%)", top: -200, right: -100, animation: "float 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,100,200,0.1) 0%, transparent 70%)", bottom: -150, left: -80, animation: "float 6s ease-in-out infinite 1s" }} />
      </div>
 
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "0 20px 60px" }}>
 
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 0 0", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: -1, background: "linear-gradient(120deg, #b088ff, #ff88dd, #88ffdd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              SmartAI Shop
            </h1>
            <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>
              Compare · Analyze · Buy Smart
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {avatar && MODELS.map((m, i) => (
              <button key={i} onClick={() => setModelIdx(i)} style={{
                background: modelIdx === i ? "rgba(180,140,255,0.15)" : "transparent", backdropFilter: "blur(6px)",
                border: `1px solid ${modelIdx === i ? "rgba(180,140,255,0.4)" : "rgba(255,255,255,0.1)"}`,
                color: modelIdx === i ? "#b088ff" : "rgba(255,255,255,0.25)",
                padding: "6px 12px", borderRadius: 18, fontSize: 10, cursor: "pointer", fontWeight: 500,
              }}>{m.label}</button>
            ))}
            <button onClick={() => setAvatar(v => !v)} style={{
              background: avatar ? "rgba(180,140,255,0.12)" : "rgba(255,255,255,0.04)", backdropFilter: "blur(6px)",
              border: `1px solid ${avatar ? "rgba(180,140,255,0.35)" : "rgba(255,255,255,0.1)"}`,
              color: avatar ? "#b088ff" : "rgba(255,255,255,0.25)",
              padding: "7px 14px", borderRadius: 18, fontSize: 11, cursor: "pointer", fontWeight: 500,
            }}>🌸 {avatar ? "On" : "Off"}</button>
          </div>
        </div>
 
        {/* Main layout */}
        <div style={{ display: "grid", gridTemplateColumns: avatar ? "1fr 260px" : "1fr", gap: 32, marginTop: 32, alignItems: "start" }}>
 
          {/* Left — search + results */}
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, opacity: 0.2 }}>🔍</span>
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && search()}
                  placeholder="Search products — iPhone 15, Nike shoes, Samsung TV..."
                  disabled={status === "searching"}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14,
                    padding: "13px 14px 13px 42px", color: "#fff", fontSize: 14, outline: "none", transition: "all 0.2s"
                  }}
                  onFocus={e => { e.target.style.background = "rgba(255,255,255,0.09)"; e.target.style.borderColor = "rgba(180,140,255,0.5)"; }}
                  onBlur={e => { e.target.style.background = "rgba(255,255,255,0.06)"; e.target.style.borderColor = "rgba(255,255,255,0.12)"; }}
                />
              </div>
              <button onClick={search} disabled={status === "searching" || !q.trim()} style={{
                background: "linear-gradient(135deg, #8B5FBF, #C165D0)", backdropFilter: "blur(8px)",
                border: "none", borderRadius: 14, padding: "0 24px", color: "#fff", fontSize: 13,
                fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                opacity: (!q.trim() || status === "searching") ? 0.5 : 1, transition: "all 0.2s"
              }}>{status === "searching" ? "Searching..." : "Search"}</button>
            </div>
            <p style={{ margin: "4px 0 20px", fontSize: 10, color: "rgba(255,255,255,0.15)", paddingLeft: 4 }}>
              Cached results instant • Fresh searches ~30 seconds
            </p>
 
            {/* Status states */}
            {status === "idle" && (
              <div style={{ textAlign: "center", padding: "80px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 16, animation: "float 3s ease-in-out infinite" }}>🛍️</div>
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 15, margin: 0, fontWeight: 500 }}>
                  Compare prices across Amazon, Flipkart & Reliance Digital
                </p>
              </div>
            )}
 
            {status === "searching" && (
              <div style={{ textAlign: "center", padding: "80px 0" }}>
                <div style={{ width: 40, height: 40, border: "2.5px solid rgba(180,140,255,0.15)", borderTopColor: "#b088ff", borderRadius: "50%", animation: "spin 0.6s linear infinite", margin: "0 auto 16px" }} />
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, margin: "0 0 6px" }}>Scraping 3 platforms for <span style={{ color: "#b088ff" }}>"{q}"</span></p>
                <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 11, margin: 0 }}>First search takes ~30 seconds</p>
              </div>
            )}
 
            {status === "error" && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ color: "rgba(255,100,100,0.7)", fontSize: 13 }}>
                  Timeout — ensure Spring Boot (8080) and Python scraper (8001) are running
                </p>
                <button onClick={() => { setStatus("idle"); setProducts([]); }} style={{
                  marginTop: 12, background: "rgba(255,100,100,0.1)", backdropFilter: "blur(4px)",
                  border: "1px solid rgba(255,100,100,0.2)", color: "rgba(255,100,100,0.7)",
                  borderRadius: 20, padding: "6px 16px", cursor: "pointer", fontSize: 11, fontWeight: 500
                }}>Reset</button>
              </div>
            )}
 
            {status === "done" && shown.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
                    <span style={{ color: "#7cffb2", fontWeight: 700 }}>{shown.length}</span> results for "{q}"
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["all", ...platforms].map(pl => (
                      <button key={pl} onClick={() => setFilter(pl)} style={{
                        fontSize: 10, padding: "4px 11px", borderRadius: 16, cursor: "pointer",
                        background: filter === pl ? "rgba(180,140,255,0.15)" : "transparent", backdropFilter: "blur(4px)",
                        border: `1px solid ${filter === pl ? "rgba(180,140,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: filter === pl ? "#b088ff" : "rgba(255,255,255,0.25)", fontWeight: 500,
                      }}>{pl === "all" ? "All" : pl}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 14 }}>
                  {shown.map((p, i) => <Card key={p.id} p={p} i={i} />)}
                </div>
                <AIPanel products={products} />
              </div>
            )}
          </div>
 
          {/* Avatar */}
          {avatar && (
            <div style={{ position: "sticky", top: 28 }}>
              <div style={{ height: 420, borderRadius: 22, background: "rgba(255,255,255,0.04)", backdropFilter: "blur(10px)", border: "1px solid rgba(180,140,255,0.15)", overflow: "hidden" }}>
                <AvatarScene key={modelIdx} modelIndex={modelIdx} onToggle={() => setAvatar(false)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
