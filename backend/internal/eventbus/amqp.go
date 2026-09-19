package eventbus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	amqp "github.com/rabbitmq/amqp091-go"
)

const interviewExchange = "go-guess.interview-notes"

type AMQPBus struct {
	url         string
	mu          sync.Mutex
	connection  *amqp.Connection
	publisher   *amqp.Channel
	consumer    *amqp.Channel
	subscribers map[chan InterviewNoteEvent]struct{}
	done        chan struct{}
	closed      bool
}

func NewAMQPBus(url string) (*AMQPBus, error) {
	bus := &AMQPBus{
		url: url, subscribers: make(map[chan InterviewNoteEvent]struct{}), done: make(chan struct{}),
	}
	deliveries, err := bus.connect()
	if err != nil {
		return nil, err
	}
	go bus.dispatch(deliveries)
	return bus, nil
}

func (b *AMQPBus) connect() (<-chan amqp.Delivery, error) {
	connection, err := amqp.Dial(b.url)
	if err != nil {
		return nil, fmt.Errorf("connect RabbitMQ: %w", err)
	}
	publisher, err := connection.Channel()
	if err != nil {
		_ = connection.Close()
		return nil, fmt.Errorf("open RabbitMQ publisher: %w", err)
	}
	consumer, err := connection.Channel()
	if err != nil {
		_ = publisher.Close()
		_ = connection.Close()
		return nil, fmt.Errorf("open RabbitMQ consumer: %w", err)
	}
	for _, channel := range []*amqp.Channel{publisher, consumer} {
		if err := channel.ExchangeDeclare(interviewExchange, "fanout", true, false, false, false, nil); err != nil {
			_ = consumer.Close()
			_ = publisher.Close()
			_ = connection.Close()
			return nil, fmt.Errorf("declare RabbitMQ exchange: %w", err)
		}
	}
	if err := publisher.Confirm(false); err != nil {
		_ = consumer.Close()
		_ = publisher.Close()
		_ = connection.Close()
		return nil, fmt.Errorf("enable RabbitMQ publisher confirms: %w", err)
	}
	queue, err := consumer.QueueDeclare("", false, true, true, false, nil)
	if err != nil {
		_ = consumer.Close()
		_ = publisher.Close()
		_ = connection.Close()
		return nil, fmt.Errorf("declare RabbitMQ queue: %w", err)
	}
	if err := consumer.QueueBind(queue.Name, "", interviewExchange, false, nil); err != nil {
		_ = consumer.Close()
		_ = publisher.Close()
		_ = connection.Close()
		return nil, fmt.Errorf("bind RabbitMQ queue: %w", err)
	}
	deliveries, err := consumer.Consume(queue.Name, "", true, true, false, false, nil)
	if err != nil {
		_ = consumer.Close()
		_ = publisher.Close()
		_ = connection.Close()
		return nil, fmt.Errorf("consume RabbitMQ events: %w", err)
	}
	b.connection, b.publisher, b.consumer = connection, publisher, consumer
	return deliveries, nil
}

func (b *AMQPBus) PublishInterviewNote(ctx context.Context, event InterviewNoteEvent) error {
	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("encode interview note event: %w", err)
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		return ErrClosed
	}
	err = b.publishConfirmed(ctx, body)
	if err == nil {
		return nil
	}
	if b.consumer != nil {
		_ = b.consumer.Close()
	}
	if b.publisher != nil {
		_ = b.publisher.Close()
	}
	if b.connection != nil {
		_ = b.connection.Close()
	}
	deliveries, reconnectErr := b.connect()
	if reconnectErr != nil {
		return fmt.Errorf("publish interview note: %w; reconnect: %v", err, reconnectErr)
	}
	go b.dispatch(deliveries)
	if err := b.publishConfirmed(ctx, body); err != nil {
		return fmt.Errorf("publish interview note after reconnect: %w", err)
	}
	return nil
}

func (b *AMQPBus) publishConfirmed(ctx context.Context, body []byte) error {
	confirmation, err := b.publisher.PublishWithDeferredConfirmWithContext(
		ctx, interviewExchange, "", false, false, amqp.Publishing{
			ContentType: "application/json", DeliveryMode: amqp.Persistent, Body: body,
		})
	if err != nil {
		return err
	}
	acknowledged, err := confirmation.WaitContext(ctx)
	if err != nil {
		return err
	}
	if !acknowledged {
		return errors.New("RabbitMQ rejected interview note")
	}
	return nil
}

func (b *AMQPBus) SubscribeInterviewNotes(ctx context.Context) (<-chan InterviewNoteEvent, error) {
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

func (b *AMQPBus) dispatch(deliveries <-chan amqp.Delivery) {
	for {
		select {
		case <-b.done:
			return
		case delivery, ok := <-deliveries:
			if !ok {
				return
			}
			var event InterviewNoteEvent
			if json.Unmarshal(delivery.Body, &event) != nil {
				continue
			}
			b.mu.Lock()
			for subscriber := range b.subscribers {
				select {
				case subscriber <- event:
				default:
				}
			}
			b.mu.Unlock()
		}
	}
}

func (b *AMQPBus) Close() error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		return nil
	}
	b.closed = true
	close(b.done)
	for subscriber := range b.subscribers {
		close(subscriber)
	}
	clear(b.subscribers)
	if b.consumer != nil {
		_ = b.consumer.Close()
	}
	if b.publisher != nil {
		_ = b.publisher.Close()
	}
	if b.connection != nil {
		return b.connection.Close()
	}
	return nil
}
