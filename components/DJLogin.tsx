"use client";

import { useState } from "react";

export default function DJLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (username === "admin" && password === "admin123") {
      localStorage.setItem("djLoggedIn", "true");
      window.location.reload();
      return;
    }

    alert("Username sau parolă greșită.");
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
        <form
          onSubmit={handleLogin}
          className="w-full rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl"
        >
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-purple-300">
            DJ Panel
          </p>

          <h1 className="mb-6 text-4xl font-black">Login</h1>

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mb-4 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 outline-none focus:border-purple-500"
          />

          <input
            type="password"
            placeholder="Parolă"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-6 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 outline-none focus:border-purple-500"
          />

          <button className="w-full rounded-2xl bg-purple-600 px-6 py-4 font-bold transition hover:bg-purple-500">
            Intră în panou
          </button>
        </form>
      </div>
    </main>
  );
}
