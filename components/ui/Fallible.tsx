"use client";

import { Component, type ReactNode } from "react";

/** Contains a failure to one part of a page: shows `fallback` instead of breaking everything. */
export class Fallible extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.warn("A page section failed to load", error); }
  render() { return this.state.failed ? (this.props.fallback ?? null) : this.props.children; }
}
