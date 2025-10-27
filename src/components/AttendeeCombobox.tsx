import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Attendee {
  id: string;
  name: string;
  phone: string;
}

interface AttendeeComboboxProps {
  attendees: Attendee[];
  value: string;
  onValueChange: (value: string) => void;
}

export function AttendeeCombobox({
  attendees,
  value,
  onValueChange,
}: AttendeeComboboxProps) {
  const [open, setOpen] = useState(false);
  
  const selectedAttendee = attendees.find((a) => a.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedAttendee
            ? `${selectedAttendee.name} (${selectedAttendee.phone})`
            : "참석자 선택..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="이름 또는 전화번호로 검색..." />
          <CommandEmpty>참석자를 찾을 수 없습니다.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-y-auto">
            {attendees.map((attendee) => (
              <CommandItem
                key={attendee.id}
                value={`${attendee.name} ${attendee.phone}`}
                onSelect={() => {
                  onValueChange(attendee.id);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === attendee.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div>
                  <div className="font-medium">{attendee.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {attendee.phone}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
