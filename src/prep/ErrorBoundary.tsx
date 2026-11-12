import { Component, type ErrorInfo, type ReactNode } from "react";

// กันหน้าขาว: ส่วนไหนพัง (เช่น ข้อมูลรูปแบบแปลกจากเอเจนต์) ให้พังแค่ส่วนนั้น แสดงข้อความ + ปุ่มลองใหม่
// ส่วนอื่นของแอป (เมนู, แท็บอื่น) ยังใช้ได้; เปลี่ยน key (เช่นเปลี่ยนหน้า/แท็บ) = เริ่มใหม่
type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label ?? "page"}]`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="pp-error" role="alert">
        <b>ส่วนนี้แสดงผลไม่ได้</b>{this.props.label ? ` (${this.props.label})` : ""} ส่วนอื่นยังใช้งานได้ตามปกติ
        <div className="pp-muted small" style={{ margin: "6px 0", wordBreak: "break-word" }}>{error.message}</div>
        <button type="button" className="pp-btn" onClick={() => this.setState({ error: null })}>ลองใหม่</button>{" "}
        <button type="button" className="pp-btn" onClick={() => window.location.reload()}>โหลดหน้าใหม่</button>
      </div>
    );
  }
}
