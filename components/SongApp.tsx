"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Song = {
  id: string;
  title: string;
  artist: string;
  votes: number;
};

type ActiveSession = {
  id: string;
  voting_open: boolean;
};

export default function SongApp() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [votingOpen, setVotingOpen] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [loading, setLoading] = useState(false);
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [votedSongId, setVotedSongId] = useState<string | null>(null);

  const suggestionRef = useRef<HTMLDivElement>(null);

  async function fetchSongs(sessionId: string) {
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .eq("session_id", sessionId)
      .order("votes", { ascending: false });

    if (!error && data) setSongs(data);
  }

  async function fetchActiveSession() {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, voting_open")
      .eq("active", true)
      .single();

    if (error || !data) {
      setCheckingSession(false);
      return null;
    }

    const session = data as ActiveSession;

    setActiveSessionId(session.id);
    setVotingOpen(session.voting_open);

    const votedSessionId = localStorage.getItem("votedSessionId");
    const savedSongId = localStorage.getItem("votedSongId");
    const votedThisSession =
      localStorage.getItem("hasVoted") === "true" &&
      votedSessionId === session.id;

    if (votedThisSession) {
      setHasVoted(true);
      setVotedSongId(savedSongId);
    } else {
      localStorage.removeItem("hasVoted");
      localStorage.removeItem("votedSongId");
      setHasVoted(false);
      setVotedSongId(null);
    }

    await fetchSongs(session.id);
    setCheckingSession(false);

    return session;
  }

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!value.trim()) {
      setFilteredSongs([]);
      return;
    }

    const filtered = songs.filter((song) =>
      `${song.title} ${song.artist}`
        .toLowerCase()
        .includes(value.toLowerCase()),
    );

    setFilteredSongs(filtered);
  }

  async function addSong(e: React.FormEvent) {
    e.preventDefault();

    if (!votingOpen) return;
    if (!title || !artist || !activeSessionId) return;

    const alreadyVoted =
      localStorage.getItem("hasVoted") === "true" &&
      localStorage.getItem("votedSessionId") === activeSessionId;

    if (alreadyVoted) {
      alert("Ai votat deja. Poți alege o singură melodie.");
      setHasVoted(true);
      return;
    }

    setLoading(true);

    const { data: existingSong } = await supabase
      .from("songs")
      .select("*")
      .eq("session_id", activeSessionId)
      .ilike("title", title.trim())
      .ilike("artist", artist.trim())
      .maybeSingle();

    if (existingSong) {
      await supabase
        .from("songs")
        .update({ votes: existingSong.votes + 1 })
        .eq("id", existingSong.id);

      localStorage.setItem("hasVoted", "true");
      localStorage.setItem("votedSongId", existingSong.id);
      localStorage.setItem("votedSessionId", activeSessionId);

      setHasVoted(true);
      setVotedSongId(existingSong.id);
    } else {
      const { data: newSong } = await supabase
        .from("songs")
        .insert({
          title: title.trim(),
          artist: artist.trim(),
          session_id: activeSessionId,
          votes: 1,
        })
        .select()
        .single();

      if (newSong) {
        localStorage.setItem("hasVoted", "true");
        localStorage.setItem("votedSongId", newSong.id);
        localStorage.setItem("votedSessionId", activeSessionId);

        setHasVoted(true);
        setVotedSongId(newSong.id);
      }
    }

    setTitle("");
    setArtist("");
    setFilteredSongs([]);
    setLoading(false);
    fetchSongs(activeSessionId);
  }

  async function voteSong(songId: string, currentVotes: number) {
    if (!votingOpen) return;
    if (!activeSessionId) return;

    const alreadyVoted =
      localStorage.getItem("hasVoted") === "true" &&
      localStorage.getItem("votedSessionId") === activeSessionId;

    if (alreadyVoted) {
      alert("Ai votat deja. Poți vota o singură melodie.");
      setHasVoted(true);
      return;
    }

    const { error } = await supabase
      .from("songs")
      .update({ votes: currentVotes + 1 })
      .eq("id", songId);

    if (!error) {
      localStorage.setItem("hasVoted", "true");
      localStorage.setItem("votedSongId", songId);
      localStorage.setItem("votedSessionId", activeSessionId);

      setHasVoted(true);
      setVotedSongId(songId);
      fetchSongs(activeSessionId);
    }
  }

  useEffect(() => {
    void fetchActiveSession();

    const channel = supabase
      .channel("public-vote-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "songs",
        },
        async () => {
          const sessionId = activeSessionId;

          if (sessionId) {
            await fetchSongs(sessionId);
          } else {
            await fetchActiveSession();
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sessions",
        },
        async () => {
          await fetchActiveSession();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeSessionId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(e.target as Node)
      ) {
        setFilteredSongs([]);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const topSongs = songs.slice(0, 3);
  const otherSongs = songs.slice(3);
  const voteButtonText = hasVoted ? "Ai votat" : "Votează";

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-5 text-white">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-purple-300">
            DJ Vote Live
          </p>
          <h1 className="mt-4 text-4xl font-black">Se încarcă...</h1>
        </div>
      </main>
    );
  }

  if (!votingOpen) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-5 text-white">
        <div className="absolute left-[-120px] top-[-120px] h-[340px] w-[340px] rounded-full bg-purple-700/30 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-120px] h-[360px] w-[360px] rounded-full bg-fuchsia-700/25 blur-3xl" />

        <section className="relative z-10 mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl backdrop-blur-xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-purple-300">
            DJ Vote Live
          </p>

          <h1 className="text-5xl font-black leading-tight">
            Votul nu a început încă
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-zinc-400">
            Așteaptă ca DJ-ul să deschidă sesiunea. Pagina se va actualiza
            automat când votul pornește.
          </p>

          <div className="mx-auto mt-8 inline-flex rounded-full border border-purple-500/20 bg-purple-500/10 px-5 py-2 text-sm font-bold text-purple-200">
            În așteptare
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-5 py-10 text-white">
      <div className="absolute left-[-120px] top-[-120px] h-[340px] w-[340px] rounded-full bg-purple-700/30 blur-3xl" />
      <div className="absolute bottom-[20%] right-[-140px] h-[360px] w-[360px] rounded-full bg-fuchsia-700/25 blur-3xl" />
      <div className="absolute left-[35%] top-[20%] h-[240px] w-[240px] rounded-full bg-blue-700/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <section className="mb-10 text-center">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-purple-300">
            DJ Vote Live
          </p>

          <h1 className="mx-auto max-w-3xl text-5xl font-black leading-tight md:text-7xl">
            Alege piesa care ajunge la DJ
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base text-zinc-400 md:text-lg">
            Propune o melodie sau votează una deja adăugată. Cea mai populară
            piesă urcă în top.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <form
            onSubmit={addSong}
            className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-6">
              <p className="text-sm font-semibold text-purple-300">
                Propune sau caută
              </p>
              <h2 className="mt-1 text-3xl font-bold">Melodia ta</h2>
            </div>

            <div className="relative mb-4" ref={suggestionRef}>
              <input
                type="text"
                placeholder="Scrie titlul melodiei..."
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                disabled={hasVoted}
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-base outline-none transition placeholder:text-zinc-600 focus:border-purple-500 disabled:cursor-default disabled:opacity-60"
              />

              {filteredSongs.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
                  {filteredSongs.map((song) => (
                    <button
                      type="button"
                      key={song.id}
                      onClick={() => {
                        setTitle(song.title);
                        setArtist(song.artist);
                        setFilteredSongs([]);
                      }}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/10"
                    >
                      <div>
                        <p className="font-semibold">{song.title}</p>
                        <p className="text-sm text-zinc-400">{song.artist}</p>
                      </div>

                      <span className="shrink-0 rounded-full bg-purple-500/10 px-3 py-1 text-sm font-bold text-purple-200">
                        {song.votes} {song.votes === 1 ? "vot" : "voturi"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-6">
              <input
                type="text"
                placeholder="Artist..."
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                disabled={hasVoted}
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-base outline-none transition placeholder:text-zinc-600 focus:border-purple-500 disabled:cursor-default disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={loading || hasVoted}
              className="w-full rounded-2xl bg-purple-600 px-6 py-4 text-lg font-bold transition hover:bg-purple-500 disabled:cursor-default disabled:opacity-60"
            >
              {hasVoted
                ? "Ai trimis alegerea"
                : loading
                  ? "Se trimite..."
                  : "Trimite alegerea"}
            </button>

            <p className="mt-4 text-center text-sm text-zinc-500">
              {hasVoted
                ? "Alegerea ta a fost înregistrată."
                : "Poți alege o singură melodie."}
            </p>
          </form>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-purple-300">Live</p>
                <h2 className="text-3xl font-bold">Top 3</h2>
              </div>

              <span className="rounded-full bg-purple-500/20 px-4 py-2 text-sm font-bold text-purple-200">
                {songs.length} piese
              </span>
            </div>

            <div className="space-y-4">
              {topSongs.length === 0 && (
                <p className="rounded-2xl border border-white/10 bg-black/30 p-5 text-zinc-400">
                  Încă nu există melodii propuse.
                </p>
              )}

              {topSongs.map((song, index) => (
                <div
                  key={song.id}
                  className={`flex items-center justify-between gap-4 rounded-3xl border p-5 transition-all duration-300 ${
                    votedSongId === song.id
                      ? "border-purple-400/60 bg-purple-500/10 shadow-[0_0_30px_rgba(168,85,247,0.18)]"
                      : "border-white/10 bg-black/40"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl font-black text-black">
                      #{index + 1}
                    </div>

                    <div>
                      <p className="text-xl font-bold">{song.title}</p>
                      <p className="text-zinc-400">{song.artist}</p>

                      {votedSongId === song.id && (
                        <div className="mt-2 inline-flex items-center rounded-full border border-purple-400/30 bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-200">
                          Alegerea ta
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <button
                      disabled={hasVoted}
                      onClick={() => voteSong(song.id, song.votes)}
                      className="rounded-full border border-purple-400/20 bg-purple-500/15 px-5 py-2 font-bold text-purple-100 transition-all duration-300 hover:scale-105 hover:border-purple-300/40 hover:bg-purple-500/25 hover:shadow-[0_0_25px_rgba(168,85,247,0.35)] disabled:cursor-default disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none"
                    >
                      {voteButtonText}
                    </button>

                    <div className="mt-2 inline-flex items-center rounded-full border border-purple-500/20 bg-purple-500/5 px-2.5 py-0.5 text-xs font-medium text-purple-300/80">
                      {song.votes} {song.votes === 1 ? "vot" : "voturi"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {otherSongs.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-4 text-2xl font-bold">Toate melodiile</h2>

            <div className="grid gap-4 md:grid-cols-2">
              {otherSongs.map((song) => (
                <div
                  key={song.id}
                  className={`flex items-center justify-between gap-4 rounded-3xl border p-5 transition-all duration-300 ${
                    votedSongId === song.id
                      ? "border-purple-400/60 bg-purple-500/10 shadow-[0_0_30px_rgba(168,85,247,0.18)]"
                      : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  <div>
                    <p className="text-lg font-bold">{song.title}</p>
                    <p className="text-zinc-400">{song.artist}</p>

                    {votedSongId === song.id && (
                      <div className="mt-2 inline-flex items-center rounded-full border border-purple-400/30 bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-200">
                        Alegerea ta
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <button
                      disabled={hasVoted}
                      onClick={() => voteSong(song.id, song.votes)}
                      className="rounded-full border border-purple-400/20 bg-purple-500/10 px-4 py-2 font-semibold text-purple-100 transition-all duration-300 hover:scale-105 hover:border-purple-300/40 hover:bg-purple-500/20 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] disabled:cursor-default disabled:opacity-40 disabled:hover:scale-100 disabled:hover:bg-purple-500/10 disabled:hover:shadow-none"
                    >
                      {voteButtonText}
                    </button>

                    <div className="mt-2 inline-flex items-center rounded-full border border-purple-500/20 bg-purple-500/5 px-2.5 py-0.5 text-xs font-medium text-purple-300/80">
                      {song.votes} {song.votes === 1 ? "vot" : "voturi"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
