"use client";
import { usePageturnRouter } from "pageturn/next";

export default function C() {
  const router = usePageturnRouter();
  return (
    <div>
      <h1>c</h1>
      <button id="go" type="button" onClick={() => router.push("/d")}>
        go to d
      </button>
    </div>
  );
}
