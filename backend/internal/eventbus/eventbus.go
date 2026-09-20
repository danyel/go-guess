package eventbus

import (
	"context"
	"errors"
	"sync"
	"time"
)

type InterviewNoteEvent struct {
	ID           uint      `json:"id"`
	AuthorUserID uint      `json:"authorUserId"`
	AuthorName   string    `json:"authorName"`
	Body         string    `json:"body"`
	CreatedAt    time.Time `json:"createdAt"`
}

type InterviewAttendeeEvent struct {
	UserID      uint   `json:"userId"`
	DisplayName string `json:"displayName"`
	Email       string `json:"email"`
	Status      string `json:"status"`
}

type InterviewEvent struct {
	Type           string                  `json:"type"`
	InterviewID    uint                    `json:"interviewId"`
	Note           *InterviewNoteEvent     `json:"note,omitempty"`
	Attendee       *InterviewAttendeeEvent `json:"attendee,omitempty"`
	Status         string                  `json:"status,omitempty"`
	SharedDocument string                  `json:"sharedDocument,omitempty"`
}

type IEventBus interface {
	PublishInterviewEvent(context.Context, InterviewEvent) error
	SubscribeInterviewEvents(context.Context) (<-chan InterviewEvent, error)
	Close() error
}

var ErrClosed = errors.New("event bus is closed")

type MemoryBus struct {
	mu          sync.RWMutex
	subscribers map[chan InterviewEvent]struct{}
	closed      bool
}

func NewMemoryBus() *MemoryBus {
	return &MemoryBus{subscribers: make(map[chan InterviewEvent]struct{})}
}

func (b *MemoryBus) PublishInterviewEvent(ctx context.Context, event InterviewEvent) error {
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.closed {
		return ErrClosed
	}
	for subscriber := range b.subscribers {
		select {
		case subscriber <- event:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}

func (b *MemoryBus) SubscribeInterviewEvents(ctx context.Context) (<-chan InterviewEvent, error) {
	b.mu.Lock()
	if b.closed {
		b.mu.Unlock()
		return nil, ErrClosed
	}
	ch := make(chan InterviewEvent, 16)
	b.subscribers[ch] = struct{}{}
	b.mu.Unlock()
	go func() {
		<-ctx.Done()
		b.mu.Lock()
		if _, ok := b.subscribers[ch]; ok {
			delete(b.subscribers, ch)
			close(ch)
		}
		b.mu.Unlock()
	}()
	return ch, nil
}

func (b *MemoryBus) Close() error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		return nil
	}
	b.closed = true
	for subscriber := range b.subscribers {
		close(subscriber)
	}
	clear(b.subscribers)
	return nil
}
