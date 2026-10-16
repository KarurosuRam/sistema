import { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LabelList,
} from 'recharts'

export const PALETA = ['#1f47dd', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#64748b', '#14b8a6', '#a855f7', '#eab308']

const eje = { fontSize: 11, fill: '#64748b' }

function Envoltura({ altura = 280, children }) {
  return (
    <div style={{ width: '100%', height: altura }}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  )
}

export function Barras({ datos, categorias, altura = 280, apilado, horizontal, etiquetas, unidadSufijo = '' }) {
  return (
    <Envoltura altura={altura}>
      <BarChart data={datos} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, bottom: 4, left: horizontal ? 8 : 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={!horizontal ? false : true} horizontal={!horizontal ? true : false} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={eje} />
            <YAxis type="category" dataKey="nombre" tick={eje} width={168} />
          </>
        ) : (
          <>
            <XAxis dataKey="nombre" tick={eje} interval={0} angle={datos.length > 6 ? -18 : 0} textAnchor={datos.length > 6 ? 'end' : 'middle'} height={datos.length > 6 ? 58 : 30} />
            <YAxis tick={eje} />
          </>
        )}
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          formatter={(v, n) => [`${v}${unidadSufijo}`, n]}
        />
        {categorias.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {categorias.map((c, i) => (
          <Bar key={c.clave} dataKey={c.clave} name={c.titulo} stackId={apilado ? 'a' : undefined} fill={c.color ?? PALETA[i % PALETA.length]} radius={apilado ? 0 : [4, 4, 0, 0]}>
            {etiquetas && <LabelList dataKey={c.clave} position="top" style={{ fontSize: 10, fill: '#64748b' }} />}
          </Bar>
        ))}
      </BarChart>
    </Envoltura>
  )
}

export function Lineas({ datos, categorias, altura = 300, dominio }) {
  return (
    <Envoltura altura={altura}>
      <LineChart data={datos} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="nombre" tick={eje} />
        <YAxis tick={eje} domain={dominio ?? ['auto', 'auto']} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {categorias.map((c, i) => (
          <Line
            key={c.clave} type="monotone" dataKey={c.clave} name={c.titulo} stroke={c.color ?? PALETA[i % PALETA.length]}
            strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls
          />
        ))}
      </LineChart>
    </Envoltura>
  )
}

export function Torta({ datos, altura = 240, nombreClave = 'nombre', valorClave = 'valor', colores, interno = 58 }) {
  const total = useMemo(() => datos.reduce((a, b) => a + (b[valorClave] ?? 0), 0), [datos, valorClave])
  return (
    <div className="relative">
      <Envoltura altura={altura}>
        <PieChart>
          <Pie data={datos} dataKey={valorClave} nameKey={nombreClave} innerRadius={interno} outerRadius={88} paddingAngle={1.5} strokeWidth={1}>
            {datos.map((d, i) => <Cell key={d[nombreClave]} fill={colores?.[i] ?? d.color ?? PALETA[i % PALETA.length]} />)}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            formatter={(v, n) => [`${v} (${total ? Math.round((v / total) * 100) : 0}%)`, n]}
          />
        </PieChart>
      </Envoltura>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" style={{ height: altura }}>
        <span className="text-2xl font-semibold tabular-nums text-slate-900">{total}</span>
        <span className="text-[11px] uppercase tracking-wide text-slate-500">total</span>
      </div>
    </div>
  )
}

export function RadarNotas({ datos, altura = 300, categorias }) {
  return (
    <Envoltura altura={altura}>
      <RadarChart data={datos} outerRadius="72%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#475569' }} />
        <PolarRadiusAxis domain={[1, 10]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickCount={6} />
        {categorias.map((c, i) => (
          <Radar key={c.clave} name={c.titulo} dataKey={c.clave} stroke={c.color ?? PALETA[i]} fill={c.color ?? PALETA[i]} fillOpacity={0.25} strokeWidth={2} />
        ))}
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
      </RadarChart>
    </Envoltura>
  )
}

export function Leyenda({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
      {items.map((i) => (
        <li key={i.titulo} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          <span>{i.titulo}</span>
          {i.valor !== undefined && <span className="font-semibold tabular-nums text-slate-800">{i.valor}</span>}
        </li>
      ))}
    </ul>
  )
}
