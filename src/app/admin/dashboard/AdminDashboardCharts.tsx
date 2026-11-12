"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ArrowUpRight, Target, Users } from "lucide-react";

export function AdminDashboardCharts({ 
    momData, 
    leadSources, 
    agentsCount, 
    revenueStr,
    growthPct = "--%",
    targetPct = "--%"
}: any) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Main Stats Card with Area Chart */}
            <div className="p-6 bg-white border border-neutral-100 rounded-2xl shadow-sm card-shadow">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className="text-sm font-medium text-neutral-500 mb-1">Total Revenue</p>
                        <h2 className="text-3xl font-bold text-neutral-900">{revenueStr}</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                <ArrowUpRight size={12} className="mr-1" /> {growthPct}
                            </span>
                            <span className="text-xs text-neutral-400">vs last month</span>
                        </div>
                    </div>
                </div>

                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={momData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2F6AA8" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#2F6AA8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F3F7" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1B4332', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                itemStyle={{ color: '#fff', fontSize: '12px' }}
                                labelStyle={{ display: 'none' }}
                                cursor={{ stroke: '#1B4332', strokeWidth: 1, strokeDasharray: '4 4' }}
                            />
                            <Area type="monotone" dataKey="value" stroke="#2F6AA8" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="space-y-6">
                {/* Secondary Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mb-3 shadow-sm text-primary">
                            <Users size={16} />
                        </div>
                        <p className="text-xl font-bold text-neutral-900">{agentsCount}</p>
                        <p className="text-xs text-neutral-500 mt-1">Total Active Agents</p>
                    </div>
                    <div className="p-5 bg-white border border-neutral-100 rounded-2xl shadow-sm card-shadow">
                        <div className="w-8 h-8 bg-neutral-50 rounded-lg flex items-center justify-center mb-3 text-neutral-600">
                            <Target size={16} />
                        </div>
                        <p className="text-xl font-bold text-neutral-900">{targetPct}</p>
                        <p className="text-xs text-neutral-500 mt-1">Target Met</p>
                    </div>
                </div>

                {/* Lead Distribution Pie Chart */}
                <div className="p-6 bg-white border border-neutral-100 rounded-2xl shadow-sm card-shadow">
                    {leadSources && leadSources.length > 0 ? (
                        <>
                            <div className="h-[220px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={leadSources}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {leadSources.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                                    <p className="text-2xl font-bold text-neutral-900">{leadSources.reduce((sum: number, s: any) => sum + s.value, 0)}</p>
                                    <p className="text-[10px] uppercase tracking-wide text-neutral-400">Total Leads</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4 justify-center">
                                {leadSources.map((item: any) => (
                                    <div key={item.name} className="flex items-center gap-1.5 px-2 py-1 bg-neutral-50 rounded-lg">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-xs font-medium text-neutral-600">{item.name}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-xs text-neutral-400">No leads data available</div>
                    )}
                </div>
            </div>
        </div>
    );
}
