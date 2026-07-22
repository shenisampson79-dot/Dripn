/**
 * Local error boundary for outfit/wardrobe visuals.
 * Soft fallback only — never the full-screen "Oops! Dripn hit a snag".
 */

import React, { Component, type ReactNode } from 'react';

import { SoftRenderFallback } from '@/components/SoftRenderFallback';
import { logInvalidRender } from '@/utils/safeRender';

type Props = {
  children: ReactNode;
  fallbackMessage?: string;
  onError?: (error: Error, stack: string) => void;
};

type State = { error: Error | null };

export class RenderErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    logInvalidRender('render_boundary', {
      message: error?.message,
      stack: info?.componentStack?.slice?.(0, 400),
    });
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, info.componentStack);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <SoftRenderFallback
          message={this.props.fallbackMessage || 'Outfit preview unavailable'}
        />
      );
    }
    return this.props.children;
  }
}
