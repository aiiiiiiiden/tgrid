import React from 'react';

interface PresetAvatarProps {
  imgSrc?: string;
  color?: string;
}

export default function PresetAvatar({ imgSrc, color }: PresetAvatarProps) {
  if (imgSrc) {
    return (
      <img
        src={imgSrc}
        alt=""
        className="size-5 shrink-0 rounded-sm object-cover"
        style={color ? { boxShadow: `0 0 0 1.5px ${color}` } : undefined}
      />
    );
  }
  if (color) {
    return <span className="size-5 rounded-full shrink-0" style={{ background: color }} />;
  }
  return <span className="size-5 rounded-full shrink-0 bg-muted" />;
}
