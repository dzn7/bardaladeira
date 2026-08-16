'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type OpcaoSelect = {
  valor: string
  label: string
}

type CampoSelectFiltroProps = {
  id: string
  label: string
  value: string
  onChange: (valor: string) => void
  opcoes: ReadonlyArray<OpcaoSelect>
}

export const CampoSelectFiltro = ({
  id,
  label,
  value,
  onChange,
  opcoes,
}: CampoSelectFiltroProps) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="text-sm font-medium text-foreground">
      {label}
    </Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-10 w-full border-border/70 shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((opcao) => (
          <SelectItem key={opcao.valor} value={opcao.valor}>
            {opcao.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)
