export const AVATAR_HOSTS = {
  GOOGLE: "googleusercontent.com",
  GITHUB: "avatars.githubusercontent.com",
  DISCORD: "cdn.discordapp.com",
  FACEBOOK: "platform-lookaside.fbsbx.com",
  X: "pbs.twimg.com",
} as const;

type AvatarRule = {
  match: (url: string) => boolean;
  normalize: (url: string, px: number) => string;
};

const AVATAR_RULES: AvatarRule[] = [
  {
    match: (u) => u.includes(AVATAR_HOSTS.GOOGLE),
    normalize: (u, px) => {
      if (/=s\d+/.test(u) || /[?&]sz=\d+/.test(u)) return u;
      const join = u.includes("?") ? "&" : "?";
      return `${u}${join}sz=${px}`;
    },
  },
  {
    match: (u) => u.includes(AVATAR_HOSTS.GITHUB),
    normalize: (u, px) => {
      if (/[?&]s=\d+/.test(u)) return u;
      const join = u.includes("?") ? "&" : "?";
      return `${u}${join}s=${px}`;
    },
  },
  {
    match: (u) => u.includes(AVATAR_HOSTS.DISCORD),
    normalize: (u, px) => {
      if (/[?&]size=\d+/.test(u)) return u;
      const join = u.includes("?") ? "&" : "?";
      return `${u}${join}size=${px}`;
    },
  },
  {
    match: (u) => u.includes(AVATAR_HOSTS.FACEBOOK),
    normalize: (u, px) => {
      if (/[?&](height|width)=\d+/.test(u)) return u;
      const join = u.includes("?") ? "&" : "?";
      return `${u}${join}height=${px}&width=${px}`;
    },
  },
  {
    match: (u) => u.includes(AVATAR_HOSTS.X),
    normalize: (u, px) => {
      if (/[?&]name=/.test(u)) return u;

      const name =
        px <= 48 ? "small" :
        px <= 96 ? "normal" :
        "bigger";

      const join = u.includes("?") ? "&" : "?";
      return `${u}${join}name=${name}`;
    },
  }
];

export function normalizeAvatarUrl(url: string, px: number) {
  const rule = AVATAR_RULES.find((r) => r.match(url));
  return rule ? rule.normalize(url, px) : url;
}

const AVATAR_HOST_VALUES = Object.values(AVATAR_HOSTS);

export function isProviderAvatar(url?: string | null): boolean {
  if (!url) return false;
  return AVATAR_HOST_VALUES.some((host) => url.includes(host));
}
