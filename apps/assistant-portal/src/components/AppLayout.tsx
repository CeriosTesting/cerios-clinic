import { DashboardOutlined, CalendarOutlined, TeamOutlined, UserOutlined, LogoutOutlined } from "@ant-design/icons";
import { Layout, Menu } from "antd";
import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";

import keycloak from "../keycloak";

const { Sider, Content } = Layout;

interface KeycloakTokenParsed {
	realm_access?: { roles: string[] };
	name?: string;
	preferred_username?: string;
}

const MENU_ITEMS = [
	{ key: "/", icon: <DashboardOutlined />, label: "Dashboard" },
	{ key: "/appointments", icon: <CalendarOutlined />, label: "Appointments" },
	{ key: "/patients", icon: <UserOutlined />, label: "Patients" },
	{ key: "/admin", icon: <TeamOutlined />, label: "Admin" },
];

export default function AppLayout(): React.ReactElement {
	const navigate = useNavigate();
	const location = useLocation();
	const [collapsed, setCollapsed] = useState(false);

	const roles: string[] = (keycloak.tokenParsed as KeycloakTokenParsed)?.realm_access?.roles ?? [];
	const isAdmin = roles.includes("admin");

	const displayName =
		(keycloak.tokenParsed as KeycloakTokenParsed)?.name ??
		(keycloak.tokenParsed as KeycloakTokenParsed)?.preferred_username ??
		"Unknown";

	const items = isAdmin ? MENU_ITEMS : MENU_ITEMS.filter(i => i.key !== "/admin");

	const selectedKey =
		MENU_ITEMS.slice()
			.reverse()
			.find(i => location.pathname === i.key || location.pathname.startsWith(i.key + "/"))?.key ?? "/";

	return (
		<Layout style={{ minHeight: "100vh" }}>
			<Sider
				collapsible
				collapsed={collapsed}
				onCollapse={setCollapsed}
				style={{ position: "sticky", top: 0, height: "100vh" }}
			>
				<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
					<div
						style={{
							padding: collapsed ? "20px 0" : "20px 16px",
							borderBottom: "1px solid rgba(255,255,255,0.08)",
							marginBottom: 8,
							textAlign: collapsed ? "center" : "left",
						}}
					>
						{!collapsed && (
							<>
								<div
									style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase" }}
								>
									Cerios Clinic
								</div>
								<div style={{ fontWeight: 700, color: "#fff", fontSize: 15, marginTop: 2 }}>Assistant Portal</div>
							</>
						)}
					</div>

					<Menu
						theme="dark"
						mode="inline"
						selectedKeys={[selectedKey]}
						items={items}
						onClick={({ key }) => {
							void navigate(key);
						}}
						style={{ flex: 1 }}
					/>

					<div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
						{!collapsed && (
							<div
								style={{
									padding: "12px 16px 4px",
									overflow: "hidden",
								}}
							>
								<div
									style={{
										fontSize: 13,
										fontWeight: 600,
										color: "rgba(255,255,255,0.85)",
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
								>
									{displayName}
								</div>
							</div>
						)}
						<Menu
							theme="dark"
							mode="inline"
							selectable={false}
							onClick={() => {
								void keycloak.logout({ redirectUri: window.location.origin + "/login" });
							}}
							items={[{ key: "logout", icon: <LogoutOutlined />, label: "Sign out" }]}
						/>
					</div>
				</div>
			</Sider>

			<Layout>
				<Content style={{ padding: 32, background: "#F5F7FA" }}>
					<Outlet />
				</Content>
			</Layout>
		</Layout>
	);
}
