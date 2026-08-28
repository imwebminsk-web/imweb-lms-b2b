"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { SearchIcon, XIcon, DownloadIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AnalyticsToolbar({
  teams,
  courses,
  tags,
}: {
  teams: { id: string; name: string }[];
  courses: { id: string; title: string }[];
  tags: { id: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [team, setTeam] = useState(searchParams.get("team") ?? "all");
  const [course, setCourse] = useState(searchParams.get("course") ?? "all");
  const [tag, setTag] = useState(searchParams.get("tag") ?? "all");

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  const applyFilters = useCallback(
    (key: string, value: string) => {
      const qs = createQueryString(key, value);
      router.push(`${pathname}?${qs}`);
    },
    [pathname, router, createQueryString]
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (searchParams.get("q") ?? "")) {
        applyFilters("q", search);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchParams, applyFilters]);

  const handleReset = () => {
    setSearch("");
    setTeam("all");
    setCourse("all");
    setTag("all");
    router.push(pathname);
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-sm">
          <SearchIcon className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
          <Input
            placeholder="Поиск по ФИО..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={team}
          onValueChange={(val) => {
            setTeam(val);
            applyFilters("team", val);
          }}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Все отделы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все отделы</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={course}
          onValueChange={(val) => {
            setCourse(val);
            applyFilters("course", val);
          }}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Все курсы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все курсы</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={tag}
          onValueChange={(val) => {
            setTag(val);
            applyFilters("tag", val);
          }}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Все теги" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все теги</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || team !== "all" || course !== "all" || tag !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
          >
            Сбросить
            <XIcon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      {course !== "all" && (
        <Button variant="outline" className="w-full md:w-auto">
          <DownloadIcon className="mr-2 h-4 w-4" />
          Экспорт CSV
        </Button>
      )}
    </div>
  );
}
