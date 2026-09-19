package eventbus

import (
	"context"
	"errors"
	"sync"
	"time"
)

type InterviewNoteEvent struct {
	InterviewID  uint      `json:"interviewId"`
	ID           uint      `json:"id"`
	AuthorUserID uint      `json:"authorUserId"`
	AuthorName   string    `json:"authorName"`
	Body         string    `json:"body"`
	CreatedAt    time.Time `json:"createdAt"`
}

type IEventBus interface {
	PublishInterviewNote(context.Context, InterviewNoteEvent) error
	SubscribeInterviewNotes(context.Context) (<-chan InterviewNoteEvent, error)
	Close() error
}

var ErrClosed = errors.New("event bus is closed")

type MemoryBus struct {
	mu          sync.RWMutex
	subscribers map[chan InterviewNoteEvent]struct{}
	closed      bool
}

func NewMemoryBus() *MemoryBus {
	return &MemoryBus{subscribers: make(map[chan InterviewNoteEvent]struct{})}
}

func (b *MemoryBus) PublishInterviewNote(ctx context.Context, event InterviewNoteEvent) error {
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

func (b *MemoryBus) SubscribeInterviewNotes(ctx context.Context) (<-chan InterviewNoteEvent, error) {
	b.mu.Lock()
	if b.closed {
		b.mu.Unlock()
		return nil, ErrClosed
	}
	ch := make(chan InterviewNoteEvent, 16)
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
