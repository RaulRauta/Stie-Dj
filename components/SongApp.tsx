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

  const leader = songs[0];
  const otherSongs = songs.slice(1);
  const voteButtonText = hasVoted ? "Ai votat" : "Votează";

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050208] px-5 text-white">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-purple-300/90">
            Live Music Voting
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white/90">
            Se încarcă...
          </h1>
        </div>
      </main>
    );
  }

  if (!votingOpen) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050208] px-5 text-white">
        <div className="absolute left-[-120px] top-[-120px] h-[340px] w-[340px] rounded-full bg-purple-700/35 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-120px] h-[360px] w-[360px] rounded-full bg-fuchsia-700/30 blur-3xl" />

        <section className="relative z-10 mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-7 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl border border-purple-400/20 bg-purple-500/10 text-3xl">
            ♪
          </div>

          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-purple-300/90">
            Live Music Voting
          </p>

          <h1 className="text-4xl font-black leading-[0.95] tracking-[-0.04em] text-white/90 md:text-5xl">
            Pregătim votul
          </h1>

          <p className="mx-auto mt-5 max-w-md text-[15px] font-medium leading-7 tracking-[0.01em] text-zinc-300/75">
            Stai aproape. Când DJ-ul pornește sesiunea, pagina se actualizează
            automat și poți alege piesa ta.
          </p>

          <div className="mx-auto mt-8 inline-flex rounded-full border border-purple-500/20 bg-purple-500/10 px-5 py-2 text-sm font-bold text-purple-200">
            În așteptare
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050208] px-4 py-6 text-white md:px-6 md:py-10">
      <div className="absolute left-[-130px] top-[-130px] h-[360px] w-[360px] rounded-full bg-purple-700/35 blur-3xl" />
      <div className="absolute right-[-160px] top-[260px] h-[380px] w-[380px] rounded-full bg-fuchsia-700/25 blur-3xl" />
      <div className="absolute bottom-[10%] left-[30%] h-[260px] w-[260px] rounded-full bg-blue-700/10 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-5xl">
        <section className="mb-6 rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 text-center shadow-2xl backdrop-blur-xl md:p-8">
          <div className="mx-auto mb-5 inline-flex rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-purple-200">
            Live Music Voting
          </div>

          <h1 className="mx-auto max-w-3xl text-4xl font-black leading-[0.92] tracking-[-0.055em] text-white/95 md:text-7xl">
            Tu alegi următoarea piesă
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-[15px] font-medium leading-7 tracking-[0.01em] text-zinc-300/75 md:text-lg">
            Scanează, alege melodia ta și urc-o în top. Piesa cu cele mai multe
            voturi ajunge direct la DJ.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 md:mx-auto md:max-w-md">
            <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Melodii
              </p>
              <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-white/90">
                {songs.length}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Voturi
              </p>
              <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-white/90">
                {songs.reduce((total, song) => total + song.votes, 0)}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <form
            onSubmit={addSong}
            className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl md:p-6"
          >
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-purple-300/90">
                Intră în joc
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white/90">
                Caută piesa ta
              </h2>
            </div>

            <div className="relative mb-3" ref={suggestionRef}>
              <input
                type="text"
                placeholder="Ex: After Dark"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                disabled={hasVoted}
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-base font-medium text-white/90 outline-none transition placeholder:text-zinc-600 focus:border-purple-500 disabled:cursor-default disabled:opacity-60"
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
                        <p className="font-bold text-white/90">{song.title}</p>
                        <p className="text-sm font-medium text-zinc-400">
                          {song.artist}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-sm font-bold text-purple-200">
                        {song.votes} {song.votes === 1 ? "vot" : "voturi"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-5">
              <input
                type="text"
                placeholder="Ex: Mr.Kitty"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                disabled={hasVoted}
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-base font-medium text-white/90 outline-none transition placeholder:text-zinc-600 focus:border-purple-500 disabled:cursor-default disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={loading || hasVoted}
              className="w-full rounded-2xl border border-purple-400/20 bg-purple-500/20 px-6 py-4 text-base font-black text-purple-50 transition-all duration-300 hover:scale-[1.01] hover:bg-purple-500/30 hover:shadow-[0_0_24px_rgba(168,85,247,0.25)] disabled:cursor-default disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              {hasVoted
                ? "Alegerea ta a fost trimisă"
                : loading
                  ? "Se trimite..."
                  : "Trimite votul"}
            </button>

            <p className="mt-4 text-center text-xs font-medium leading-5 text-zinc-500">
              {hasVoted
                ? "Poți urmări live clasamentul mai jos."
                : "Poți alege o singură melodie în această sesiune."}
            </p>
          </form>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-purple-300/90">
                  Live
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-white/90">
                  Topul serii
                </h2>
              </div>

              <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-200">
                Top live
              </span>
            </div>

            {!leader && (
              <p className="rounded-3xl border border-white/10 bg-black/30 p-6 text-center text-[15px] font-medium leading-6 text-zinc-400">
                Încă nu există melodii propuse.
              </p>
            )}

            {leader && (
              <div
                className={`mb-4 rounded-[2rem] border p-5 transition-all duration-300 ${
                  votedSongId === leader.id
                    ? "border-purple-400/60 bg-purple-500/15 shadow-[0_0_35px_rgba(168,85,247,0.18)]"
                    : "border-purple-400/25 bg-purple-500/10"
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-purple-200/90">
                      În frunte acum
                    </p>
                    <h3 className="mt-2 truncate text-4xl font-black leading-[0.95] tracking-[-0.055em] text-white/95">
                      {leader.title}
                    </h3>
                    <p className="mt-2 truncate text-base font-medium text-zinc-300/80">
                      {leader.artist}
                    </p>

                    {votedSongId === leader.id && (
                      <div className="mt-4 inline-flex rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-100">
                        Alegerea ta
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 rounded-3xl border border-purple-400/25 bg-black/35 px-4 py-3 text-center shadow-[0_0_24px_rgba(168,85,247,0.12)]">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-200/70">
                      Voturi
                    </p>
                    <p className="mt-1 text-4xl font-black leading-none tracking-[-0.06em] text-white/95">
                      {leader.votes}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-purple-200/70">
                      {leader.votes === 1 ? "vot" : "voturi"}
                    </p>
                  </div>
                </div>

                <button
                  disabled={hasVoted}
                  onClick={() => voteSong(leader.id, leader.votes)}
                  className="w-full rounded-2xl border border-purple-400/20 bg-purple-500/20 px-5 py-3 font-black text-purple-50 transition-all duration-300 hover:scale-[1.01] hover:bg-purple-500/30 hover:shadow-[0_0_24px_rgba(168,85,247,0.25)] disabled:cursor-default disabled:opacity-45 disabled:hover:scale-100 disabled:hover:shadow-none"
                >
                  {voteButtonText}
                </button>
              </div>
            )}

            <div className="space-y-3">
              {otherSongs.map((song, index) => (
                <div
                  key={song.id}
                  className={`flex items-center justify-between gap-3 rounded-3xl border p-4 transition-all duration-300 ${
                    votedSongId === song.id
                      ? "border-purple-400/60 bg-purple-500/10 shadow-[0_0_25px_rgba(168,85,247,0.14)]"
                      : "border-white/10 bg-black/30"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-zinc-200">
                      #{index + 2}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-black tracking-[-0.025em] text-white/90">
                        {song.title}
                      </p>
                      <p className="truncate text-sm font-medium text-zinc-400">
                        {song.artist}
                      </p>

                      {votedSongId === song.id && (
                        <div className="mt-2 inline-flex rounded-full border border-purple-400/30 bg-purple-500/10 px-2.5 py-1 text-xs font-bold text-purple-100">
                          Alegerea ta
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <button
                      disabled={hasVoted}
                      onClick={() => voteSong(song.id, song.votes)}
                      className="rounded-full border border-purple-400/20 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-100 transition-all duration-300 hover:bg-purple-500/20 disabled:cursor-default disabled:opacity-40"
                    >
                      {voteButtonText}
                    </button>

                    <div className="mt-2 text-xs font-bold text-purple-300/80">
                      {song.votes} {song.votes === 1 ? "vot" : "voturi"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
