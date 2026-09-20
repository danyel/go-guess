import {ScheduledInterview} from "../../types";
import {useEffect, useMemo, useState} from "react";
import {message} from "../../components/actions";
import {api} from "../../api/client";
import {ErrorAlert, Loading} from "../../components/ui/AsyncState";
import {InterviewCard} from "../interviews/components/InterviewCard";
import {Link} from "react-router-dom";

export function CalendarPage() {
    const [items, setItems] = useState<ScheduledInterview[]>([])
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    useEffect(() => {
        void api
            .calendar()
            .then(setItems)
            .catch((value) => setError(message(value)))
            .finally(() => setLoading(false))
    }, [])
    const groups = useMemo(() => {
        return [...items]
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
            .reduce<Record<string, ScheduledInterview[]>>((result, item) => {
                const key = new Date(item.startsAt).toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                    })
                ;(result[key] ??= []).push(item)
                return result
            }, {})
    }, [items])
    return (
        <>
            <header className="page-header">
                <div>
                    <span className="eyebrow">Schedule</span>
                </div>
            </header>
            {error && <ErrorAlert error={error}/>}
            {loading ? (
                <Loading/>
            ) : (
                Object.entries(groups).map(([date, interviews]) => (
                    <section className="calendar-day" key={date}>
                        <h2>{date}</h2>
                        <div className="meeting-list">
                            {interviews.map((item) => (
                                <InterviewCard interview={item} key={item.id}>
                                    <Link className="button secondary" to={`/scheduled-interviews/${item.id}`}>
                                        Open session
                                    </Link>
                                </InterviewCard>
                            ))}
                        </div>
                    </section>
                ))
            )}
        </>
    )
}