# Premissa de Fuso Horário — Sistema Samira Estética

## Como funciona (a partir de out/2026)

### Frontend
- Inputs `datetime-local` retornam strings **sem timezone**: `"2026-10-14T14:30"`
- Ao salvar a ficha, o frontend agora envia `offsetMin` = `new Date().getTimezoneOffset() * -1`
- Cada lembrete pode opcionalmente ter seu próprio `offsetMin` (override)

### Backend (`agendar-lembretes.js`)
- Lê `body.offsetMin` (fallback: `-180` = BRT)
- Converte `datetime-local` → UTC usando `parseDataHoraLocalParaUTC()`
- Fórmula: `UTC = local − offsetMin` (em minutos)

### Exemplos
| Dispositivo | getTimezoneOffset() | offsetMin enviado | "14:30" vira |
|---|---|---|---|
| BRT (UTC-3) | 180 | -180 | 17:30 UTC |
| UTC | 0 | 0 | 14:30 UTC |
| Lisboa (UTC+1, verão) | -60 | 60 | 13:30 UTC |
| Tóquio (UTC+9) | -540 | 540 | 05:30 UTC (dia seguinte) |

### Retrocompatibilidade
- Se o frontend NÃO enviar `offsetMin`, o backend usa `-180` (BRT).
- Isso garante que sistemas antigos continuam funcionando.

### Limitação conhecida
- `checar-lembretes-esteticista.js` e `checar-lembretes-paciente.js`
  ainda usam `TZ_OFFSET_MIN = -3 * 60` fixo, porque `ag.data` e
  `ag.horaInicio` são strings **sem timezone** que sempre representam
  BRT (a agenda é configurada em Salto/SP).

## Resolvido
- ✅ Lembretes agora respeitam o fuso do dispositivo que os criou
- ✅ Paciente viajando pode agendar lembrete no horário local dele
- ✅ Compatível com fusos com horário de verão