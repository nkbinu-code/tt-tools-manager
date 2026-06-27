"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Wrench } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function login() {
    setLoading(true);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      alert("Incorrect password");
    }
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#edf4ff",
      }}
    >
      <div
        style={{
          width: 420,
          background: "#fff",
          borderRadius: 16,
          padding: 40,
          boxShadow: "0 10px 35px rgba(0,0,0,.12)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: "50%",
            background: "#0057ff",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            margin: "0 auto 20px",
          }}
        >
          <Wrench color="#fff" size={34} />
        </div>

        <h2 style={{ marginBottom: 6 }}>T&T Tools Manager</h2>

        <p style={{ color: "#666", marginBottom: 30 }}>
          Enter your password
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: "0 12px",
            marginBottom: 20,
          }}
        >
          <Lock size={20} color="#666" />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") login();
            }}
            style={{
              border: 0,
              outline: 0,
              padding: 14,
              width: "100%",
              fontSize: 16,
            }}
          />
        </div>

        <button
          onClick={login}
          disabled={loading}
          style={{
            width: "100%",
            padding: 14,
            background: "#0057ff",
            color: "#fff",
            border: 0,
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {loading ? "Signing In..." : "Sign In"}
        </button>
      </div>
    </div>
  );
}