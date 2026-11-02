import { useState } from "react";

export default function ResultCard({ r }) {
    const [open, setOpen] = useState(false);
    const { test, value, low, high, status, needsAttention } = r;

    function speak() {
        window.speechSynthesis.cancel();
        const reason = status === "low" ? test.whyLow : status === "high" ? test.whyHigh : "";
        const text = `${test.name} is ${value} ${test.unit}. The normal range is ${low} to ${high}. This is ${status}. ${test.what} ${reason}`;
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-IN";
        window.speechSynthesis.speak(u);
    }

    return (
        <div className={`card ${status}`}>
            <div className="row" onClick={() => setOpen(!open)}>
                <strong>{test.name}</strong>
                <span>{value} {test.unit}</span>
                <span className="range">Normal: {low}–{high}</span>
                <span className={`chip ${status}`}>{status.toUpperCase()}</span>
            </div>

            {open && (

                <div className="details">
                    <button className="speakBtn" onClick={speak}>Read aloud</button>
                    <p><b>What it is:</b> {test.what}</p>
                    {status === "low" && <p><b>Why it may be low:</b> {test.whyLow}</p>}
                    {status === "high" && <p><b>Why it may be high:</b> {test.whyHigh}</p>}
                    {needsAttention && (
                        <p className="alert">This is well outside the range. Please contact your doctor soon.</p>
                    )}
                    {status !== "normal" && (
                        <>
                            <b>Ask your doctor:</b>
                            <ul>{test.questions.map((q) => <li key={q}>{q}</li>)}</ul>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}