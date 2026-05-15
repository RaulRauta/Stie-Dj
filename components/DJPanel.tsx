"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Song = {
  id: string;
  title: string;
  artist: string;
  votes: number;
};

type Session = {
  id: string;
  name: string;
  voting_open: boolean;
};

export default function DJPanel() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [resetting, setResetting] = useState(false);
  const [updatingVote, setUpdatingVote] = useState(false);

  const winner = songs[0];
  const queue = songs.slice(1);

  async function fetchSongs(sessionId: string) {
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .eq("session_id", sessionId)
      .order("votes", { ascending: false });

    if (!error && data) {
      setSongs(data);
    }
  }

  async function fetchActiveSession() {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, name, voting_open")
      .eq("active", true)
      .single();

    if (!error && data) {
      setActiveSession(data);
      await fetchSongs(data.id);
    }
  }

  async function toggleVoting() {
    if (!activeSession) return;

    setUpdatingVote(true);

    const response = await fetch("/api/dj/toggle-voting", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: activeSession.id,
        votingOpen: !activeSession.voting_open,
      }),
    });

    if (!response.ok) {
      alert("Nu am putut actualiza statusul votului.");
    }

    await fetchActiveSession();
    setUpdatingVote(false);
  }

  async function deleteSong(songId: string) {
    const confirmDelete = confirm("Sigur vrei să ștergi melodia?");
    if (!confirmDelete) return;

    const response = await fetch("/api/dj/delete-song", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ songId }),
    });

    if (!response.ok) {
      alert("Nu am putut șterge melodia.");
    }

    await fetchActiveSession();
  }

  async function resetSession() {
    const confirmReset = confirm(
      "Sigur vrei să pornești o sesiune nouă? Toate melodiile și voturile actuale vor fi resetate.",
    );

    if (!confirmReset) return;

    setResetting(true);

    const response = await fetch("/api/dj/reset-session", {
      method: "POST",
    });

    if (!response.ok) {
      alert("Nu am putut reseta sesiunea.");
    }

    await fetchActiveSession();
    setResetting(false);
  }

  function logout() {
    localStorage.removeItem("djLoggedIn");
    window.location.reload();
  }

  useEffect(() => {
    void fetchActiveSession();

    const channel = supabase
      .channel("dj-live-panel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "songs",
        },
        () => {
          void fetchActiveSession();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sessions",
        },
        () => {
          void fetchActiveSession();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-6 py-10 text-white">
      <div className="absolute left-[-120px] top-[-120px] h-[340px] w-[340px] rounded-full bg-purple-700/30 blur-3xl" />
      <div className="absolute bottom-[15%] right-[-140px] h-[360px] w-[360px] rounded-full bg-fuchsia-700/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-purple-300">
              DJ Control Room
            </p>

            <h1 className="text-5xl font-black">Panou DJ</h1>

            <p className="mt-3 max-w-2xl text-zinc-400">
              Vezi topul live, gestionează propunerile și pornește o sesiune
              nouă.
            </p>

            {activeSession && (
              <p className="mt-2 text-sm text-purple-300/80">
                Sesiune activă: {activeSession.name}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={toggleVoting}
              disabled={updatingVote || !activeSession}
              className={`rounded-full border px-5 py-2 text-sm font-semibold transition-all duration-300 disabled:cursor-default disabled:opacity-50 ${
                activeSession?.voting_open
                  ? "border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                  : "border-green-400/30 bg-green-500/10 text-green-200 hover:bg-green-500/20"
              }`}
            >
              {updatingVote
                ? "Se actualizează..."
                : activeSession?.voting_open
                  ? "Închide votul"
                  : "Deschide votul"}
            </button>

            <button
              onClick={resetSession}
              disabled={resetting}
              className="rounded-full border border-purple-400/20 bg-purple-500/10 px-5 py-2 text-sm font-semibold text-purple-100 transition-all duration-300 hover:bg-purple-500/20 hover:shadow-[0_0_20px_rgba(168,85,247,0.22)] disabled:cursor-default disabled:opacity-50"
            >
              {resetting ? "Se resetează..." : "Reset sesiune"}
            </button>

            <button
              onClick={logout}
              className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/10"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-zinc-400">Melodii propuse</p>
            <p className="mt-2 text-4xl font-black">{songs.length}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-zinc-400">Total voturi</p>
            <p className="mt-2 text-4xl font-black">
              {songs.reduce((total, song) => total + song.votes, 0)}
            </p>
          </div>

          <div
            className={`rounded-3xl border p-5 ${
              activeSession?.voting_open
                ? "border-green-400/20 bg-green-500/10"
                : "border-red-400/20 bg-red-500/10"
            }`}
          >
            <p className="text-sm text-zinc-400">Status vot</p>
            <p
              className={`mt-2 text-4xl font-black ${
                activeSession?.voting_open ? "text-green-300" : "text-red-300"
              }`}
            >
              {activeSession?.voting_open ? "Deschis" : "Închis"}
            </p>
          </div>
        </section>

        {winner && (
          <section className="mb-6 rounded-[2rem] border border-purple-400/30 bg-purple-500/10 p-6 shadow-[0_0_40px_rgba(168,85,247,0.16)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-purple-300">
                  Lider momentan
                </p>
                <h2 className="mt-2 text-4xl font-black">{winner.title}</h2>
                <p className="mt-1 text-lg text-zinc-300">{winner.artist}</p>
              </div>

              <div className="text-right">
                <div className="rounded-full border border-purple-400/30 bg-black/30 px-4 py-2 text-lg font-black text-purple-100">
                  {winner.votes} {winner.votes === 1 ? "vot" : "voturi"}
                </div>

                <button
                  onClick={() => deleteSong(winner.id)}
                  className="mt-3 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
                >
                  Șterge
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-purple-300">Queue</p>
              <h2 className="text-3xl font-bold">Restul melodiilor</h2>
            </div>

            <span className="rounded-full bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-200">
              {queue.length} în listă
            </span>
          </div>

          <div className="space-y-3">
            {queue.map((song, index) => (
              <div
                key={song.id}
                className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-black/30 p-4 transition hover:bg-white/[0.06]"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-zinc-200">
                    #{index + 2}
                  </div>

                  <div>
                    <p className="text-lg font-bold">{song.title}</p>
                    <p className="text-sm text-zinc-400">{song.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-purple-500/20 bg-purple-500/5 px-3 py-1 text-sm font-bold text-purple-200">
                    {song.votes} {song.votes === 1 ? "vot" : "voturi"}
                  </div>

                  <button
                    onClick={() => deleteSong(song.id)}
                    className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
                  >
                    Șterge
                  </button>
                </div>
              </div>
            ))}

            {songs.length === 0 && (
              <p className="rounded-3xl border border-white/10 bg-black/30 p-6 text-zinc-400">
                Nu există melodii propuse încă.
              </p>
            )}

            {songs.length === 1 && (
              <p className="rounded-3xl border border-white/10 bg-black/30 p-6 text-zinc-400">
                Există doar liderul momentan. Restul listei este goală.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
