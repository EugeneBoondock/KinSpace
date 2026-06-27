import Image from 'next/image'
import { platformAvatarOptions } from '@/lib/profile-avatars'

type PlatformAvatarPickerProps = {
  disabled?: boolean
  onSelect: (avatarUrl: string) => void
  selectedAvatarUrl?: string | null
}

export default function PlatformAvatarPicker({
  disabled = false,
  onSelect,
  selectedAvatarUrl,
}: PlatformAvatarPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {platformAvatarOptions.map((option) => {
        const isSelected = selectedAvatarUrl === option.src

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.src)}
            aria-pressed={isSelected}
            disabled={disabled}
            className={`rounded-2xl border p-2 transition-all ${
              isSelected
                ? 'border-[#D19A58] bg-[#D19A58]/12 shadow-[0_0_0_1px_rgba(209,154,88,0.25)]'
                : 'border-brand-background/10 bg-brand-background/5 hover:border-brand-background/20 hover:bg-brand-background/8'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <Image
              src={option.src}
              alt={`${option.label} avatar`}
              width={64}
              height={64}
              className="h-16 w-16 rounded-2xl object-cover"
            />
            <span className="mt-2 block text-center text-[11px] font-semibold text-brand-background/75">
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
