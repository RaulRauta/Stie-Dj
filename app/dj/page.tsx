"use client";

import { useEffect, useState } from "react";
import DJLogin from "@/components/DJLogin";
import DJPanel from "@/components/DJPanel";

export default function DJPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const isLoggedIn = localStorage.getItem("djLoggedIn") === "true";
    setLoggedIn(isLoggedIn);
  }, []);

  if (loggedIn === null) {
    return null;
  }

  return loggedIn ? <DJPanel /> : <DJLogin />;
}
