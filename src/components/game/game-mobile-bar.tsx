"use client";
// src/components/game/game-mobile-bar.tsx  [U2]
// UI_REDESIGN §5.3: "sticky action bar (5 primary buttons + 'More' sheet)".
// The five that matter with a thumb — board view, flip, fullscreen, the one
// game verb this mode offers, and the panel — stay out; everything else moves
// into a Drawer so the board keeps the screen.
import { useState } from "react";
import {
  BoxIcon,
  CameraIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  ExpandIcon,
  Grid2x2Icon,
  HandshakeIcon,
  InfoIcon,
  KeyboardIcon,
  LightbulbIcon,
  ListIcon,
  MessagesSquareIcon,
  MinimizeIcon,
  MonitorIcon,
  RefreshCwIcon,
  SettingsIcon,
  SmartphoneIcon,
  UndoIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ActionBar } from "@/components/ui-kit";
import { errorCopyFor } from "@/lib/errors";
import { useUiStore } from "@/lib/stores/ui-store";
import { cn } from "@/lib/ui";
import type { BoardView, CameraPresetId, Colour, GameActions, GameMode } from "@/lib/types";
import { ResignAction } from "./game-action-bar";
import { useIsLandscape, toggleScreenOrientation } from "./use-viewport";

/** Which tab the panel button opens onto, so the label names what happens. */
export type MobilePanelTab = "chat" | "moves" | "info";

const PANEL_BUTTON: Record<MobilePanelTab, { icon: typeof BoxIcon; label: string }> = {
  chat: { icon: MessagesSquareIcon, label: "Chat" },
  moves: { icon: ListIcon, label: "Moves" },
  info: { icon: InfoIcon, label: "Info" },
};

export interface GameMobileBarProps {
  mode: GameMode;
  seat: Colour | "both" | null;
  boardView: BoardView;
  webglAvailable: boolean | null;
  orientation: Colour;
  focus: boolean;
  pending: boolean;
  canUndo: boolean;
  canResign: boolean;
  canOfferDraw: boolean;
  hint: { available: boolean; remaining: number; disabledReason: string | null; request(): void };
  actions: GameActions;
  /** The tab the sheet will land on — names the panel button (§4 "say what happens"). */
  panelTab: MobilePanelTab;
  onToggleView(): void;
  onToggleFocus(): void;
  onOpenPanel(): void;
  onOpenRoom(): void;
  onOpenShortcuts(): void;
  unread?: number;
  className?: string;
}

const CAMERA_ITEMS: { preset: CameraPresetId; label: string }[] = [
  { preset: "white", label: "White seat" },
  { preset: "black", label: "Black seat" },
  { preset: "top", label: "Top down" },
  { preset: "cinematic", label: "Orbit" },
];

/**
 * One thumb-sized button: icon over a 10px caption, so nothing is a mystery glyph.
 *
 * `min-h-11` is the 44px touch floor, and the caption is the accessible name unless
 * `srLabel` gives a fuller one — "Exit" reads as a whole verb under the icon while a
 * screen reader still hears "Exit fullscreen".
 */
function BarButton({
  icon: Icon,
  label,
  srLabel,
  onClick,
  count,
  badge,
  disabled = false,
  tone = "default",
  vertical = false,
  className,
}: {
  icon: typeof BoxIcon;
  label: string;
  srLabel?: string;
  /** A mono count that sits under the label, e.g. "2 left". */
  count?: string;
  badge?: number | string | null;
  onClick(event: React.MouseEvent<HTMLButtonElement>): void;
  disabled?: boolean;
  tone?: "default" | "primary";
  vertical?: boolean;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-disabled={disabled || undefined}
      aria-label={srLabel}
      className={cn(
        vertical
          ? "relative h-auto w-[52px] sm:w-[56px] min-h-8.5 py-1 px-0.5 flex-col gap-0.5 text-[9.5px] font-medium leading-none rounded-xl"
          : "h-auto min-h-9 sm:min-h-11 min-w-0 flex-1 flex-col gap-0.5 px-0! py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-medium leading-tight",
        tone === "primary" && "text-primary",
        disabled && "opacity-50",
        className,
      )}
    >
      <div className="relative">
        <Icon aria-hidden className="size-4 sm:size-4.5 shrink-0" />
        {badge ? (
          <span
            aria-hidden
            className="tabular absolute -top-1.5 -right-2.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-primary px-0.5 text-[9px] leading-none font-semibold text-primary-foreground"
          >
            {badge}
          </span>
        ) : null}
      </div>
      <span
        aria-hidden={srLabel ? true : undefined}
        className="max-w-full truncate px-0.5 tracking-tighter sm:tracking-tight"
      >
        {label}
      </span>
      {count ? (
        <span aria-hidden className="tabular font-mono text-[9px] text-muted-foreground leading-none">
          {count}
        </span>
      ) : null}
    </Button>
  );
}

function MoreItem({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: typeof BoxIcon;
  label: string;
  onClick(): void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Button
      variant={danger ? "destructive" : "outline"}
      // §4.8 item 3: a destructive row in this sheet is a 44px target.
      className={cn("justify-start", danger && "min-h-11")}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon aria-hidden />
      {label}
    </Button>
  );
}

export function GameMobileBar({
  mode,
  seat,
  boardView,
  webglAvailable,
  orientation,
  focus,
  pending,
  canUndo,
  canResign,
  canOfferDraw,
  hint,
  actions,
  panelTab,
  unread,
  onToggleView,
  onToggleFocus,
  onOpenPanel,
  onOpenRoom,
  onOpenShortcuts,
  className,
}: GameMobileBarProps) {
  const setCameraPreset = useUiStore((s) => s.setCameraPreset);
  const [open, setOpen] = useState(false);
  const is3d = boardView === "3d";
  const noWebgl = webglAvailable === false;
  const isLandscape = useIsLandscape();
  const isVerticalRail = isLandscape;
  const flip = () => actions.setOrientation(orientation === "w" ? "b" : "w");
  const panel = PANEL_BUTTON[panelTab];

  const toggleOrientation = async () => {
    if (!isLandscape) {
      await toggleScreenOrientation(true);
    } else {
      await toggleScreenOrientation(false);
    }
  };

  return (
    <ActionBar
      label="Game actions"
      className={cn(
        isVerticalRail
          ? "flex-col w-auto h-auto p-1.5 gap-1 rounded-2xl bg-card/95 shadow-soft border border-border/20 backdrop-blur-md"
          : "flex-nowrap gap-0.5 sm:gap-1 overflow-visible px-1 py-0.5 sm:py-1",
        className,
      )}
      variant={focus ? "focus" : "default"}
    >
      <BarButton
        icon={is3d ? Grid2x2Icon : BoxIcon}
        label={is3d ? "2D" : "3D"}
        vertical={isVerticalRail}
        disabled={!is3d && noWebgl}
        onClick={() => {
          if (is3d || !noWebgl) onToggleView();
        }}
      />
      <BarButton
        icon={isLandscape ? SmartphoneIcon : MonitorIcon}
        label={isLandscape ? "Portrait" : "Horizontal"}
        srLabel={isLandscape ? "Switch to portrait view" : "Switch to horizontal view"}
        vertical={isVerticalRail}
        onClick={toggleOrientation}
      />
      <BarButton
        icon={isVerticalRail || focus ? MinimizeIcon : ExpandIcon}
        label={isVerticalRail || focus ? "Exit" : "Fullscreen"}
        srLabel={isVerticalRail || focus ? "Exit fullscreen" : "Fullscreen"}
        vertical={isVerticalRail}
        onClick={async () => {
          if (isVerticalRail) {
            useUiStore.getState().setLayoutMode("default");
            await toggleScreenOrientation(false);
          } else {
            onToggleFocus();
          }
        }}
      />
      {hint.available ? (
        <BarButton
          icon={LightbulbIcon}
          label="Hint"
          count={`${hint.remaining} left`}
          srLabel={`Ask for a hint · ${hint.remaining} left`}
          vertical={isVerticalRail}
          disabled={hint.disabledReason !== null}
          onClick={() => {
            if (hint.disabledReason === null) hint.request();
          }}
        />
      ) : (
        <BarButton
          icon={UndoIcon}
          label={mode === "local" ? "Undo" : "Take back"}
          vertical={isVerticalRail}
          disabled={!canUndo || mode === "online" || seat === null}
          onClick={() => {
            void actions.undo();
          }}
        />
      )}
      <BarButton
        icon={panel.icon}
        label={panel.label}
        badge={unread && unread > 0 ? (unread > 9 ? "9+" : unread) : undefined}
        vertical={isVerticalRail}
        onClick={onOpenPanel}
      />

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger
          render={
            <Button
              variant="ghost"
              aria-label="More game actions"
              className={cn(
                isVerticalRail
                  ? "relative h-auto w-[52px] sm:w-[56px] min-h-8.5 py-1 px-0.5 flex-col gap-0.5 text-[9.5px] font-medium leading-none rounded-xl"
                  : "h-auto min-h-9 sm:min-h-11 min-w-0 flex-1 flex-col gap-0.5 px-0! py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-medium leading-tight",
              )}
            />
          }
        >
          <EllipsisIcon aria-hidden className="size-4 sm:size-4.5 shrink-0" />
          <span className="max-w-full truncate px-0.5 tracking-tight">More</span>
        </DrawerTrigger>
        <DrawerContent className="max-h-[85dvh] landscape:max-h-[92dvh] landscape:max-w-2xl landscape:mx-auto transition-[transform,opacity,filter]">
          <DrawerHeader className="relative flex flex-row items-center justify-between pb-2">
            <div className="flex flex-col gap-0.5 text-left">
              <DrawerTitle>More actions</DrawerTitle>
              <DrawerDescription>
                Everything that does not fit on the bar.
              </DrawerDescription>
            </div>
            <DrawerClose
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Close"
                  className="size-8 rounded-full"
                >
                  <XIcon className="size-4" aria-hidden />
                </Button>
              }
            />
          </DrawerHeader>
          <div className="grid gap-2 overflow-y-auto px-4 pb-8">
            {/* Flip left the bar so five buttons fit 390px without truncating
                their caps; it is cosmetic in a live game and a thumb aimed at
                Fullscreen kept landing on it (critique, 2026-09-10). */}
            <p className="eyebrow pt-1">Board &amp; View</p>
            <div className="flex flex-col gap-2">
              <MoreItem
                icon={RefreshCwIcon}
                label="Flip the board"
                onClick={() => {
                  flip();
                  setOpen(false);
                }}
              />
              <MoreItem
                icon={isLandscape ? SmartphoneIcon : MonitorIcon}
                label={isLandscape ? "Vertical view (Standard)" : "Horizontal view"}
                onClick={async () => {
                  setOpen(false);
                  await toggleOrientation();
                }}
              />
              <MoreItem
                icon={focus ? MinimizeIcon : ExpandIcon}
                label={focus ? "Exit to standard view" : "Fullscreen focus"}
                onClick={() => {
                  if (focus) {
                    useUiStore.getState().setLayoutMode("default");
                    void toggleScreenOrientation(false);
                  } else {
                    onToggleFocus();
                  }
                  setOpen(false);
                }}
              />
            </div>

            {is3d && !noWebgl ? (
              <>
                <p className="eyebrow pt-2">Camera</p>
                <div className="grid grid-cols-2 gap-2">
                  {CAMERA_ITEMS.map((item) => (
                    <Button
                      key={item.preset}
                      variant="outline"
                      className="justify-start"
                      onClick={() => {
                        setCameraPreset(item.preset);
                        setOpen(false);
                      }}
                    >
                      <CameraIcon aria-hidden />
                      {item.label}
                    </Button>
                  ))}
                </div>
              </>
            ) : null}

            {seat !== null ? (
              <>
                <p className="eyebrow pt-2">Game</p>
                <div className="flex flex-col gap-2">
                  {hint.available ? (
                    <MoreItem
                      icon={UndoIcon}
                      label={mode === "local" ? "Undo move" : "Take back"}
                      disabled={!canUndo || mode === "online"}
                      onClick={() => {
                        void actions.undo();
                        setOpen(false);
                      }}
                    />
                  ) : null}
                  {mode === "online" ? (
                    <MoreItem
                      icon={HandshakeIcon}
                      label="Offer draw"
                      disabled={!canOfferDraw || pending}
                      onClick={() => {
                        void actions.offerDraw();
                        setOpen(false);
                      }}
                    />
                  ) : null}
                  <ResignAction
                    mode={mode}
                    wide
                    disabledReason={
                      canResign && !pending ? null : errorCopyFor("game-not-active", "game")
                    }
                    onResign={() => {
                      void actions.resign();
                      setOpen(false);
                    }}
                  />
                </div>
              </>
            ) : null}

            <p className="eyebrow pt-2">More</p>
            <div className="flex flex-col gap-2">
              <MoreItem
                icon={CopyIcon}
                label="Copy game moves"
                onClick={() => {
                  void actions.copyPgn();
                  setOpen(false);
                }}
              />
              <MoreItem
                icon={DownloadIcon}
                label="Download game (.pgn)"
                onClick={() => {
                  actions.downloadPgn();
                  setOpen(false);
                }}
              />
              {/* §4.8 item 6: "Room" is the one name for the room action, in the
                  desktop bar and here. */}
              <MoreItem
                icon={SettingsIcon}
                label="Board & room settings"
                onClick={() => {
                  onOpenRoom();
                  setOpen(false);
                }}
              />
              <MoreItem
                icon={KeyboardIcon}
                label="Keyboard shortcuts"
                onClick={() => {
                  onOpenShortcuts();
                  setOpen(false);
                }}
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </ActionBar>
  );
}
