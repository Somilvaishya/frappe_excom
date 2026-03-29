import * as React from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  /** ISO datetime-local min (e.g. "2026-03-29T14:00") */
  min?: string;
  placeholder?: string;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DateTimePicker({
  value,
  onChange,
  min,
  placeholder = "Select date & time",
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? new Date(value) : null;
  const minDate = min ? new Date(min) : null;

  const [viewMonth, setViewMonth] = React.useState<Date>(
    selected ?? new Date()
  );
  const [pickedDate, setPickedDate] = React.useState<Date | null>(selected);
  const [hour, setHour] = React.useState(selected ? selected.getHours() : new Date().getHours());
  const [minute, setMinute] = React.useState(
    selected ? roundToNearest5(selected.getMinutes()) : roundToNearest5(new Date().getMinutes())
  );

  React.useEffect(() => {
    if (open) {
      const d = value ? new Date(value) : new Date();
      setViewMonth(value ? new Date(value) : new Date());
      setPickedDate(value ? new Date(value) : null);
      setHour(value ? d.getHours() : d.getHours());
      setMinute(value ? roundToNearest5(d.getMinutes()) : roundToNearest5(d.getMinutes()));
    }
  }, [open, value]);

  const calendarDays = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    const days: Date[] = [];
    let cur = start;
    while (cur <= end) {
      days.push(cur);
      cur = addDays(cur, 1);
    }
    return days;
  }, [viewMonth]);

  function isDisabled(day: Date): boolean {
    if (!minDate) return false;
    return isBefore(day, startOfDay(minDate));
  }

  function handleDayClick(day: Date) {
    if (isDisabled(day)) return;
    setPickedDate(day);
  }

  function handleConfirm() {
    if (!pickedDate) return;
    const result = new Date(pickedDate);
    result.setHours(hour, minute, 0, 0);
    if (minDate && isBefore(result, minDate)) return;
    onChange(toLocalInputValue(result));
    setOpen(false);
  }

  function handleClear() {
    onChange("");
    setOpen(false);
  }

  const hourRef = React.useRef<HTMLDivElement>(null);
  const minuteRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        hourRef.current
          ?.querySelector(`[data-hour="${hour}"]`)
          ?.scrollIntoView({ block: "center", behavior: "instant" });
        minuteRef.current
          ?.querySelector(`[data-minute="${minute}"]`)
          ?.scrollIntoView({ block: "center", behavior: "instant" });
      }, 50);
    }
  }, [open, hour, minute]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-left transition-colors",
            "hover:border-zinc-500 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/30",
            selected ? "text-white" : "text-zinc-500",
            className
          )}
        >
          <CalendarDays className="w-4 h-4 shrink-0 text-zinc-400" />
          <span className="flex-1 truncate">
            {selected
              ? format(selected, "MMM d, yyyy · h:mm a")
              : placeholder}
          </span>
          {selected && (
            <span
              role="button"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={6} className="w-auto p-0">
        <div className="flex divide-x divide-zinc-700/60">
          {/* Calendar */}
          <div className="p-3 w-72">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setViewMonth(subMonths(viewMonth, 1))}
                className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-zinc-200">
                {format(viewMonth, "MMMM yyyy")}
              </span>
              <button
                type="button"
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs text-zinc-500 font-medium py-1"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const inMonth = isSameMonth(day, viewMonth);
                const isSelected = pickedDate && isSameDay(day, pickedDate);
                const isToday = isSameDay(day, new Date());
                const disabled = isDisabled(day);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "h-8 w-8 mx-auto rounded-lg text-xs flex items-center justify-center transition-all",
                      disabled && "opacity-25 cursor-not-allowed",
                      !disabled && !isSelected && "hover:bg-zinc-700/60",
                      !inMonth && "text-zinc-600",
                      inMonth && !isSelected && "text-zinc-300",
                      isToday && !isSelected && "ring-1 ring-zinc-600 text-white font-medium",
                      isSelected &&
                        "bg-blue-600 text-white font-semibold ring-0 hover:bg-blue-500"
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time */}
          <div className="w-28 flex flex-col">
            <div className="flex items-center gap-1.5 px-3 pt-3 pb-2">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Time
              </span>
            </div>

            <div className="flex flex-1 divide-x divide-zinc-700/60 min-h-0">
              {/* Hour column */}
              <div
                ref={hourRef}
                className="flex-1 overflow-y-auto scrollbar-thin px-1 py-1"
                style={{ maxHeight: 224 }}
              >
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    data-hour={h}
                    onClick={() => setHour(h)}
                    className={cn(
                      "w-full text-center text-xs py-1.5 rounded-md transition-colors",
                      h === hour
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    )}
                  >
                    {pad(h)}
                  </button>
                ))}
              </div>
              {/* Minute column */}
              <div
                ref={minuteRef}
                className="flex-1 overflow-y-auto scrollbar-thin px-1 py-1"
                style={{ maxHeight: 224 }}
              >
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-minute={m}
                    onClick={() => setMinute(m)}
                    className={cn(
                      "w-full text-center text-xs py-1.5 rounded-md transition-colors",
                      m === minute
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    )}
                  >
                    {pad(m)}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-2 py-2 text-center">
              <span className="text-base font-mono text-white">
                {pad(hour)}:{pad(minute)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-700/60 px-3 py-2.5">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setPickedDate(now);
                setHour(now.getHours());
                setMinute(roundToNearest5(now.getMinutes()));
                setViewMonth(now);
              }}
              className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-md hover:bg-zinc-800 transition-colors"
            >
              Now
            </button>
            <button
              type="button"
              disabled={!pickedDate}
              onClick={handleConfirm}
              className={cn(
                "text-xs font-medium px-3 py-1 rounded-md transition-colors",
                pickedDate
                  ? "bg-blue-600 text-white hover:bg-blue-500"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              )}
            >
              Confirm
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function roundToNearest5(n: number): number {
  return Math.round(n / 5) * 5;
}
