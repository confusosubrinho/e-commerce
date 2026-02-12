import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onApply: (changes: Record<string, any>, enabledFields: string[]) => void;
  isLoading?: boolean;
}

const EDITABLE_FIELDS = [
  { key: 'weight', label: 'Peso (g)', type: 'number', step: '0.01' },
  { key: 'width', label: 'Largura (cm)', type: 'number', step: '0.1' },
  { key: 'height', label: 'Altura (cm)', type: 'number', step: '0.1' },
  { key: 'depth', label: 'Comprimento (cm)', type: 'number', step: '0.1' },
  { key: 'category_id', label: 'Categoria', type: 'select' },
  { key: 'brand', label: 'Marca', type: 'text' },
] as const;

export function BulkEditDialog({ open, onOpenChange, selectedCount, onApply, isLoading }: BulkEditDialogProps) {
  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      return data || [];
    },
  });

  const toggleField = (key: string) => {
    setEnabledFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleApply = () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    const changes: Record<string, any> = {};
    const fields: string[] = [];

    enabledFields.forEach(key => {
      const val = values[key];
      const field = EDITABLE_FIELDS.find(f => f.key === key);
      if (!field) return;

      if (field.type === 'number') {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0) return;
        changes[key] = num;
      } else if (field.type === 'select') {
        if (!val) return;
        changes[key] = val;
      } else {
        changes[key] = val || null;
      }
      fields.push(key);
    });

    if (fields.length === 0) return;
    onApply(changes, fields);
    resetState();
  };

  const resetState = () => {
    setEnabledFields(new Set());
    setValues({});
    setShowConfirm(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetState();
    onOpenChange(v);
  };

  const enabledCount = enabledFields.size;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edição em Massa</DialogTitle>
          <p className="text-sm text-muted-foreground">
            <Badge variant="secondary" className="mr-1">{selectedCount}</Badge>
            produto{selectedCount !== 1 ? 's' : ''} selecionado{selectedCount !== 1 ? 's' : ''}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">Ative os campos que deseja alterar:</p>

          {EDITABLE_FIELDS.map(field => (
            <div key={field.key} className="flex items-center gap-3">
              <Switch
                checked={enabledFields.has(field.key)}
                onCheckedChange={() => toggleField(field.key)}
              />
              <div className="flex-1">
                <Label className={!enabledFields.has(field.key) ? 'text-muted-foreground' : ''}>
                  {field.label}
                </Label>
                {enabledFields.has(field.key) && (
                  <div className="mt-1">
                    {field.type === 'select' && field.key === 'category_id' ? (
                      <Select
                        value={values[field.key] || ''}
                        onValueChange={(v) => setValues(prev => ({ ...prev, [field.key]: v }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {categories?.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={field.type}
                        step={field.type === 'number' ? (field as any).step : undefined}
                        min={field.type === 'number' ? '0' : undefined}
                        value={values[field.key] || ''}
                        onChange={(e) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="h-9"
                        placeholder={field.type === 'text' ? 'Novo valor...' : '0'}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {showConfirm && (
          <div className="rounded-lg border border-orange-500/50 bg-orange-50 dark:bg-orange-950/20 p-3 space-y-1">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-medium text-sm">
              <AlertTriangle className="h-4 w-4" />
              Confirmar alteração
            </div>
            <p className="text-xs text-muted-foreground">
              {enabledCount} campo{enabledCount !== 1 ? 's' : ''} será{enabledCount !== 1 ? 'ão' : ''} alterado{enabledCount !== 1 ? 's' : ''} em{' '}
              <strong>{selectedCount}</strong> produto{selectedCount !== 1 ? 's' : ''}.
              Esta ação não pode ser desfeita facilmente.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleApply}
            disabled={enabledCount === 0 || isLoading}
          >
            {isLoading ? 'Aplicando...' : showConfirm ? 'Confirmar e Aplicar' : `Aplicar em ${selectedCount} produtos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
