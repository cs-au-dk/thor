package dk.au.cs.thor.robotium2espresso.widgets;

import dk.au.cs.thor.robotium2espresso.Solo;

public abstract class Updater<T> {
	public abstract T update();

	public static <T> Updater<T> fromId(final int id, final Solo solo) {
		return new Updater<T>() {
			public T update() {
				return (T) solo.getView(id);
			}
		};
	}
}