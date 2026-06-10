import { NextRequest, NextResponse } from "next/server";
import dns from "dns";
import { GeoInfo } from "@/lib/types";

export const runtime = "nodejs";

interface ProbeResult {
  input: string;
  hostname: string;
  resolvedIp?: string;
  geoInfo?: GeoInfo;
  error?: string;
}

function extractHostname(target: string): string {
  try {
    return new URL(target).hostname;
  } catch {
    return target.replace(/^https?:\/\//i, "").split("/")[0];
  }
}

async function probeTarget(target: string): Promise<ProbeResult> {
  const hostname = extractHostname(target);

  let resolvedIp: string | undefined;
  try {
    const addresses = await dns.promises.resolve4(hostname);
    resolvedIp = addresses[0];
  } catch (err) {
    return { input: target, hostname, error: (err as Error).message };
  }

  let geoInfo: GeoInfo | undefined;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `http://ip-api.com/json/${resolvedIp}?fields=country,countryCode,city,isp,org,as,query`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    const data = await res.json();
    geoInfo = {
      ip: data.query,
      country: data.country,
      countryCode: data.countryCode,
      city: data.city,
      isp: data.isp,
      org: data.org,
      as: data.as,
    };
  } catch {
    // geo fetch failed — still return what we have
  }

  return { input: target, hostname, resolvedIp, geoInfo };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const targets: string[] = body.targets;

  if (!Array.isArray(targets) || targets.length > 20) {
    return NextResponse.json(
      { error: "targets must be an array of at most 20 entries" },
      { status: 400 }
    );
  }

  const settled = await Promise.allSettled(targets.map(probeTarget));

  const results: ProbeResult[] = settled.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    return {
      input: targets[i],
      hostname: extractHostname(targets[i]),
      error: result.reason?.message ?? "Unknown error",
    };
  });

  return NextResponse.json(results);
}
